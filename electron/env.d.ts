// The shell's public key is bundled as text (see scripts/build-desktop.ts).
declare module "*.pem" {
  const text: string;
  export default text;
}
