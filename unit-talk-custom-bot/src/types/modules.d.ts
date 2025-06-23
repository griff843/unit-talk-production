// Global JSX namespace for React
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    
    interface Element extends React.ReactElement<any, any> { }
    interface ElementClass extends React.Component<any> {
      render(): React.ReactNode;
    }
    interface ElementAttributesProperty { props: {}; }
    interface ElementChildrenAttribute { children: {}; }
    
    interface IntrinsicAttributes extends React.Attributes { }
    interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> { }
  }
}

// DOM types
interface FileList {
  readonly length: number;
  item(index: number): File | null;
  [index: number]: File;
}

interface File extends Blob {
  readonly lastModified: number;
  readonly name: string;
  readonly webkitRelativePath: string;
}

// Export empty object to make this a module
export {};