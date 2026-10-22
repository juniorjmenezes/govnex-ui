import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

/**
 * Par título + subtítulo numa célula de tabela: nome do registro em peso
 * normal (nunca negrito) acima, detalhe secundário (e-mail, slug, data...)
 * em `text-xs text-muted-foreground` abaixo. Ícone e badge entram como
 * filhos de `EntityCellTitle`, na mesma linha; qualquer link ou botão ali
 * dentro ganha sublinhado no hover automaticamente, sem precisar declarar a
 * classe em cada chamada — é essa centralização que evita a célula de uma
 * coluna ficar com peso/tamanho diferente da célula de outra.
 */
export function EntityCellTitle({
    className,
    children,
    ...props
}: ComponentProps<'div'>) {
    return (
        <div
            data-slot="entity-cell-title"
            className={cn(
                'flex min-w-0 flex-wrap items-center gap-2 font-normal [&_a:hover]:underline [&_button:hover]:underline',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function EntityCellSubtitle({
    className,
    ...props
}: ComponentProps<'p'>) {
    return (
        <p
            data-slot="entity-cell-subtitle"
            className={cn('text-xs text-muted-foreground', className)}
            {...props}
        />
    );
}
