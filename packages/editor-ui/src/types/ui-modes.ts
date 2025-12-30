export const UIMode = {
    EDIT: 'EDIT',
    RUN: 'RUN',
    REPLAY: 'REPLAY'
} as const;

export type UIMode = (typeof UIMode)[keyof typeof UIMode];
