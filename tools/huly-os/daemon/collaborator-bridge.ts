/**
 * collaborator-bridge.ts
 *
 * Converts markdown content → Y.js CRDT binary and uploads to MinIO,
 * making TX-created issues/documents visible in Huly's Collaborator UI.
 *
 * Huly's Collaborator service expects a Y.js binary at:
 *   MinIO key: `{objectId}%{fieldName}`
 *   Bucket:    workspace UUID
 *
 * The Y.Doc must contain an XmlFragment keyed by the field name
 * (e.g., "description" for issues, "content" for documents).
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { marked, type Token, type Tokens } from 'marked';
import * as Y from 'yjs';

// ── Types ─────────────────────────────────────────────────────────────

interface CollaboratorBridgeConfig {
  minioEndpoint: string;
  minioAccessKey: string;
  minioSecretKey: string;
  bucket: string; // workspace UUID
}

interface UploadResult {
  key: string;
  bytes: number;
}

// ── Bridge ────────────────────────────────────────────────────────────

export class CollaboratorBridge {
  private s3: S3Client;
  private bucket: string;

  constructor(config: CollaboratorBridgeConfig) {
    this.bucket = config.bucket;
    this.s3 = new S3Client({
      endpoint: config.minioEndpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.minioAccessKey,
        secretAccessKey: config.minioSecretKey,
      },
      forcePathStyle: true,
    });
  }

  /**
   * Convert markdown to Y.js binary and upload to MinIO.
   * Returns the MinIO key used.
   *
   * @param objectId  Huly object ID (e.g., "inv-1772683063698-45t3a3")
   * @param fieldName "description" for issues, "content" for documents
   * @param markdown  Raw markdown text
   */
  async createCollaborativeContent(
    objectId: string,
    fieldName: string,
    markdown: string
  ): Promise<UploadResult> {
    const binary = this.markdownToYBinary(markdown, fieldName);
    const key = `${objectId}%${fieldName}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: Buffer.from(binary),
        ContentType: 'application/octet-stream',
      })
    );

    return { key, bytes: binary.length };
  }

  /**
   * Check if a Y.js binary already exists for this object+field.
   */
  async contentExists(objectId: string, fieldName: string): Promise<boolean> {
    const key = `${objectId}%${fieldName}`;
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert markdown string → Y.js binary (Uint8Array).
   * The Y.Doc contains an XmlFragment keyed by fieldName,
   * with Tiptap-compatible element names.
   */
  markdownToYBinary(markdown: string, fieldName: string): Uint8Array {
    const tokens = marked.lexer(markdown);
    const yDoc = new Y.Doc();
    const frag = yDoc.getXmlFragment(fieldName);

    this.tokensToXml(frag, tokens);

    return Y.encodeStateAsUpdate(yDoc);
  }

  // ── Token → Y.XmlElement conversion ───────────────────────────────

  private tokensToXml(parent: Y.XmlFragment, tokens: Token[]): void {
    for (const token of tokens) {
      switch (token.type) {
        case 'heading':
          this.addHeading(parent, token as Tokens.Heading);
          break;
        case 'paragraph':
          this.addParagraph(parent, token as Tokens.Paragraph);
          break;
        case 'list':
          this.addList(parent, token as Tokens.List);
          break;
        case 'code':
          this.addCodeBlock(parent, token as Tokens.Code);
          break;
        case 'blockquote':
          this.addBlockquote(parent, token as Tokens.Blockquote);
          break;
        case 'hr':
          this.addHorizontalRule(parent);
          break;
        case 'table':
          this.addTable(parent, token as Tokens.Table);
          break;
        case 'space':
          // Skip whitespace-only tokens
          break;
        default:
          // Fallback: render as paragraph with raw text
          if ('text' in token && typeof (token as { text: unknown }).text === 'string') {
            const text = (token as { text: string }).text;
            if (text.trim()) {
              this.addParagraphFromText(parent, text);
            }
          }
          break;
      }
    }
  }

  private addHeading(parent: Y.XmlFragment, token: Tokens.Heading): void {
    const el = new Y.XmlElement('heading');
    el.setAttribute('level', String(token.depth));
    this.addInlineContent(el, token.tokens ?? []);
    parent.insert(parent.length, [el]);
  }

  private addParagraph(parent: Y.XmlFragment, token: Tokens.Paragraph): void {
    const el = new Y.XmlElement('paragraph');
    this.addInlineContent(el, token.tokens ?? []);
    parent.insert(parent.length, [el]);
  }

  private addParagraphFromText(parent: Y.XmlFragment, text: string): void {
    const el = new Y.XmlElement('paragraph');
    const t = new Y.XmlText();
    t.insert(0, text);
    el.insert(0, [t]);
    parent.insert(parent.length, [el]);
  }

  private addList(parent: Y.XmlFragment, token: Tokens.List): void {
    const listTag = token.ordered ? 'orderedList' : 'bulletList';
    const el = new Y.XmlElement(listTag);

    for (const item of token.items) {
      const li = new Y.XmlElement('listItem');

      // Each list item can contain paragraphs and nested lists
      for (const childToken of item.tokens ?? []) {
        if (childToken.type === 'text') {
          const p = new Y.XmlElement('paragraph');
          const textToken = childToken as Tokens.Text;
          if (textToken.tokens && textToken.tokens.length > 0) {
            this.addInlineContent(p, textToken.tokens);
          } else {
            const t = new Y.XmlText();
            t.insert(0, textToken.text);
            p.insert(0, [t]);
          }
          li.insert(li.length, [p]);
        } else if (childToken.type === 'list') {
          this.addList(li as unknown as Y.XmlFragment, childToken as Tokens.List);
        } else if (childToken.type === 'paragraph') {
          const p = new Y.XmlElement('paragraph');
          this.addInlineContent(p, (childToken as Tokens.Paragraph).tokens ?? []);
          li.insert(li.length, [p]);
        }
      }

      el.insert(el.length, [li]);
    }

    parent.insert(parent.length, [el]);
  }

  private addCodeBlock(parent: Y.XmlFragment, token: Tokens.Code): void {
    const el = new Y.XmlElement('codeBlock');
    if (token.lang) {
      el.setAttribute('language', token.lang);
    }
    const t = new Y.XmlText();
    t.insert(0, token.text);
    el.insert(0, [t]);
    parent.insert(parent.length, [el]);
  }

  private addBlockquote(parent: Y.XmlFragment, token: Tokens.Blockquote): void {
    const el = new Y.XmlElement('blockquote');
    this.tokensToXml(el as unknown as Y.XmlFragment, token.tokens ?? []);
    parent.insert(parent.length, [el]);
  }

  private addHorizontalRule(parent: Y.XmlFragment): void {
    const el = new Y.XmlElement('horizontalRule');
    parent.insert(parent.length, [el]);
  }

  private addTable(parent: Y.XmlFragment, token: Tokens.Table): void {
    const table = new Y.XmlElement('table');

    // Header row
    const headerRow = new Y.XmlElement('tableRow');
    for (const cell of token.header) {
      const th = new Y.XmlElement('tableHeader');
      const p = new Y.XmlElement('paragraph');
      this.addInlineContent(p, cell.tokens);
      th.insert(0, [p]);
      headerRow.insert(headerRow.length, [th]);
    }
    table.insert(table.length, [headerRow]);

    // Body rows
    for (const row of token.rows) {
      const tr = new Y.XmlElement('tableRow');
      for (const cell of row) {
        const td = new Y.XmlElement('tableCell');
        const p = new Y.XmlElement('paragraph');
        this.addInlineContent(p, cell.tokens);
        td.insert(0, [p]);
        tr.insert(tr.length, [td]);
      }
      table.insert(table.length, [tr]);
    }

    parent.insert(parent.length, [table]);
  }

  // ── Inline content (bold, italic, code, links, etc.) ──────────────

  private addInlineContent(parent: Y.XmlElement, tokens: Token[]): void {
    for (const token of tokens) {
      switch (token.type) {
        case 'text': {
          const t = new Y.XmlText();
          t.insert(0, (token as Tokens.Text).text);
          parent.insert(parent.length, [t]);
          break;
        }
        case 'strong': {
          const strongToken = token as Tokens.Strong;
          const plainText = this.extractPlainText(strongToken.tokens ?? []);
          const t = new Y.XmlText();
          t.insert(0, plainText, { bold: true });
          parent.insert(parent.length, [t]);
          break;
        }
        case 'em': {
          const emToken = token as Tokens.Em;
          const plainText = this.extractPlainText(emToken.tokens ?? []);
          const t = new Y.XmlText();
          t.insert(0, plainText, { italic: true });
          parent.insert(parent.length, [t]);
          break;
        }
        case 'codespan': {
          const t = new Y.XmlText();
          t.insert(0, (token as Tokens.Codespan).text, { code: true });
          parent.insert(parent.length, [t]);
          break;
        }
        case 'link': {
          const linkToken = token as Tokens.Link;
          const linkText = this.extractPlainText(linkToken.tokens ?? []);
          const t = new Y.XmlText();
          t.insert(0, linkText, { link: linkToken.href });
          parent.insert(parent.length, [t]);
          break;
        }
        case 'br': {
          const el = new Y.XmlElement('hardBreak');
          parent.insert(parent.length, [el]);
          break;
        }
        case 'escape': {
          const t = new Y.XmlText();
          t.insert(0, (token as Tokens.Escape).text);
          parent.insert(parent.length, [t]);
          break;
        }
        default: {
          // Fallback: extract text
          if ('text' in token && typeof (token as { text: unknown }).text === 'string') {
            const t = new Y.XmlText();
            t.insert(0, (token as { text: string }).text);
            parent.insert(parent.length, [t]);
          }
          break;
        }
      }
    }
  }

  /**
   * Extract plain text from a token tree (for marks like bold/italic).
   */
  private extractPlainText(tokens: Token[]): string {
    let result = '';
    for (const t of tokens) {
      if ('text' in t && typeof (t as { text: unknown }).text === 'string') {
        result += (t as { text: string }).text;
      }
      if ('tokens' in t && Array.isArray((t as { tokens?: unknown }).tokens)) {
        result += this.extractPlainText((t as { tokens: Token[] }).tokens);
      }
    }
    return result;
  }
}
