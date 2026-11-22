// Vite's ?raw imports return a file's text; used to compare documents with the code.
declare module '*?raw' {
  const content: string;
  export default content;
}
