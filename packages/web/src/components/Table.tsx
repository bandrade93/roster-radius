import type { ReactNode } from 'react';
import styles from './Table.module.css';

export interface Column<Row> {
  readonly key: string;
  readonly header: string;
  readonly align?: 'left' | 'right';
  readonly render: (row: Row) => ReactNode;
}

interface TableProps<Row> {
  /** Describes the table for screen readers, and names its scroll area. */
  readonly caption: string;
  readonly columns: readonly Column<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  readonly minWidth?: number;
}

export function Table<Row>({ caption, columns, rows, rowKey, minWidth = 720 }: TableProps<Row>) {
  return (
    <div className={styles.scroll} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table} style={{ minWidth }}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === 'right' ? styles.right : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? styles.right : undefined}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
