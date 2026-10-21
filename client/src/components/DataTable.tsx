import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Oculta la columna en la vista de cards (móvil) */
  hideOnCard?: boolean;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Título de cada card en móvil */
  cardTitle: (row: T) => ReactNode;
  actions?: (row: T) => ReactNode;
  caption: string;
};

/** Tabla con scroll contenido en tablet/desktop y versión cards en móvil (<768px). */
export function DataTable<T>({ rows, columns, rowKey, cardTitle, actions, caption }: Props<T>) {
  return (
    <>
      <div className="data-table__table-wrap">
        <table className="data-table__table">
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.align === 'right' ? 'data-table__cell--right' : undefined}>
                  {c.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="data-table__cell--right">
                  <span className="visually-hidden">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'data-table__cell--right' : undefined}>
                    {c.render(row)}
                  </td>
                ))}
                {actions && (
                  <td>
                    <div className="data-table__actions">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="data-table__cards" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="card data-card">
            <h3 className="truncate">{cardTitle(row)}</h3>
            {columns
              .filter((c) => !c.hideOnCard)
              .map((c) => (
                <div key={c.key} className="data-card__row">
                  <span className="data-card__label">{c.header}</span>
                  <span className="data-card__value">{c.render(row)}</span>
                </div>
              ))}
            {actions && <div className="data-card__actions">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
