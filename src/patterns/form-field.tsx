import type { ReactNode } from 'react';

import { Label } from '../components/label';
import { SurfaceHelp } from '../components/surface';
import { cn } from '../lib/utils';
import { FieldError } from './field-error';

export interface FormFieldProps {
    label: string;
    htmlFor?: string;
    /** Mensagem de erro (ex.: validação do backend). */
    error?: string;
    /**
     * Explicação do campo. Vira um botão de ajuda (`SurfaceHelp`) ao lado
     * do campo — não um ícone solto perto do rótulo, nem dentro do campo.
     */
    help?: ReactNode;
    className?: string;
    children: ReactNode;
}

/**
 * Rótulo, campo e erro no espaçamento padrão de formulário. Quando há
 * `help`, o campo e o botão de ajuda ficam lado a lado, fora do grupo do
 * input — o mesmo `SurfaceHelp` já usado nos cabeçalhos de card.
 */
export function FormField({
    label,
    htmlFor,
    error,
    help,
    className,
    children,
}: FormFieldProps) {
    return (
        <div className={cn('grid gap-2', className)}>
            <Label htmlFor={htmlFor}>{label}</Label>
            {help ? (
                <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">{children}</div>
                    <SurfaceHelp>{help}</SurfaceHelp>
                </div>
            ) : (
                children
            )}
            <FieldError message={error} />
        </div>
    );
}
