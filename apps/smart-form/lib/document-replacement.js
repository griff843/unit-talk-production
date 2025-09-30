// Document replacement module to prevent Html imports outside of _document
// This module provides safe replacements for next/document components

// Export empty/noop components for Html, Head, Main, NextScript
module.exports = {
  Html: function Html({ children, ...props }) {
    return typeof window !== 'undefined' ? null : children;
  },
  Head: function Head({ children, ...props }) {
    return typeof window !== 'undefined' ? null : children;
  },
  Main: function Main(props) {
    return typeof window !== 'undefined' ? null : null;
  },
  NextScript: function NextScript(props) {
    return typeof window !== 'undefined' ? null : null;
  },
  __esModule: true,
  default: {
    Html: function Html({ children, ...props }) {
      return typeof window !== 'undefined' ? null : children;
    },
    Head: function Head({ children, ...props }) {
      return typeof window !== 'undefined' ? null : children;
    },
    Main: function Main(props) {
      return typeof window !== 'undefined' ? null : null;
    },
    NextScript: function NextScript(props) {
      return typeof window !== 'undefined' ? null : null;
    },
  }
};