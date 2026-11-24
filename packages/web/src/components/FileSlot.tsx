import { useId, type ReactNode } from 'react';
import { Tag } from './Tag';
import styles from './FileSlot.module.css';

interface FileSlotProps {
  readonly title: string;
  readonly required?: boolean;
  readonly description: string;
  readonly hint?: ReactNode;
  /** Names of the files loaded for this slot. */
  readonly loaded: readonly string[];
  readonly multiple?: boolean;
  readonly accept: string;
  readonly onChoose: (files: File[]) => void;
  readonly onClear: () => void;
}

export function FileSlot({ title, required = false, description, hint, loaded, multiple = false, accept, onChoose, onClear }: FileSlotProps) {
  const inputId = useId();
  const statusId = useId();

  return (
    <div className={`${styles.slot} ${loaded.length > 0 ? styles.filled : ''}`}>
      <div className={styles.heading}>
        <h3 className={styles.title}>{title}</h3>
        <Tag tone={required ? 'info' : 'neutral'}>{required ? 'Required' : 'Optional'}</Tag>
      </div>
      <p className={styles.description}>{description}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.actions}>
        <label htmlFor={inputId} className={styles.choose}>
          Choose {multiple ? 'files' : 'file'}
          <span className="visually-hidden"> for {title}</span>
        </label>
        <input
          id={inputId}
          className="visually-hidden"
          type="file"
          accept={accept}
          multiple={multiple}
          aria-describedby={statusId}
          onChange={(e) => {
            onChoose([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <span id={statusId} className={loaded.length > 0 ? styles.loaded : styles.empty}>
          {loaded.length === 0 ? 'Not loaded' : loaded.length === 1 ? loaded[0] : `${loaded.length} files`}
        </span>
        {loaded.length > 0 && (
          <button type="button" className={styles.clear} onClick={onClear}>
            Remove<span className="visually-hidden"> {title}</span>
          </button>
        )}
      </div>
      {loaded.length > 1 && (
        <ul className={styles.list}>
          {loaded.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
