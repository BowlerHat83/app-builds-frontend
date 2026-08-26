// Small hover-state info bubble used next to metric labels across every
// topic page, so a glance at a number's label explains what it means
// without needing a paragraph of copy on the page itself.
interface TipProps {
  text: string;
}

export default function Tip({ text }: TipProps) {
  return (
    <span className="tip" tabIndex={0}>
      <span className="tip-icon">i</span>
      <span className="tip-bubble">{text}</span>
    </span>
  );
}
