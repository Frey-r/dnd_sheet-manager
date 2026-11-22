import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
};

/**
 * Number input for decimals. A controlled <input type="number"> bound to a number loses the
 * decimal point while typing: "0." parses to 0, React writes "0" back and "0.5" ends as "05".
 * This keeps the raw text while the field is being edited and reports only parseable values.
 */
export function DecimalInput({ value, onValueChange, onBlur, ...rest }: Props) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      {...rest}
      type="number"
      value={text ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = Number(raw);
        if (raw.trim() !== '' && Number.isFinite(parsed)) onValueChange(parsed);
      }}
      onBlur={(e) => {
        setText(null);
        onBlur?.(e);
      }}
    />
  );
}
