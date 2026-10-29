import type { ReactNode } from 'react';

import { InfoCircleIcon } from '../icons';
import { InputGroupButton } from './input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * Botão de ajuda (ícone + tooltip) para o fim de um campo — pensado para
 * `endAdornment` do `AppSelect` ou um `InputGroupAddon` manual em volta de
 * `Input`, no lugar do ícone solto ao lado do rótulo.
 */
function FieldHelp({ children }: { children: ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Ajuda sobre este campo"
                >
                    <InfoCircleIcon aria-hidden="true" />
                </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent>{children}</TooltipContent>
        </Tooltip>
    );
}

export { FieldHelp };
