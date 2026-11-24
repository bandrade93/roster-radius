import styles from './Segmented.module.css';

interface SegmentedProps<T extends string> {
  readonly label: string;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/** A small set of buttons where one is pressed, to switch what a table shows. */
export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} className={styles.option} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
