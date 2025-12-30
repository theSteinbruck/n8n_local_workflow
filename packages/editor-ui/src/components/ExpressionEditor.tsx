import React, { useState, useRef, useMemo } from 'react';

interface ExpressionEditorProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    suggestions: string[];
    multiline?: boolean;
    previewValue?: any;
    error?: string;
}

export const ExpressionEditor: React.FC<ExpressionEditorProps> = ({
    value,
    onChange,
    disabled,
    placeholder,
    suggestions,
    multiline = false,
    previewValue,
    error
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [query, setQuery] = useState('');

    const allOptions = useMemo(() => [
        '$json',
        '$execution.id',
        '$execution.mode',
        '$index',
        ...suggestions.map(s => `$node["${s}"]`)
    ], [suggestions]);

    const filteredOptions = useMemo(() => {
        if (!query) return allOptions;
        return allOptions.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));
    }, [allOptions, query]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        const cursor = e.target.selectionStart;
        const textBeforeCursor = newValue.slice(0, cursor);

        // Detect if naturally inside expression {{ }} and starting with $
        const lastExpressionStart = textBeforeCursor.lastIndexOf('{{');
        const lastExpressionEnd = textBeforeCursor.lastIndexOf('}}');

        if (lastExpressionStart > lastExpressionEnd) {
            const expressionPart = textBeforeCursor.slice(lastExpressionStart + 2);
            const match = expressionPart.match(/\$([a-zA-Z0-9\[\]"'_]*)$/);
            if (match) {
                setQuery('$' + match[1]);
                setShowSuggestions(true);
                // Simple position estimation (real implementation would use a ghost element)
                setSuggestionPos({ top: 30, left: Math.min(cursor * 7, 200) });
                return;
            }
        }
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSuggestions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSuggestionIndex(i => (i + 1) % filteredOptions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSuggestionIndex(i => (i - 1 + filteredOptions.length) % filteredOptions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertSuggestion(filteredOptions[suggestionIndex]);
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        }
    };

    const insertSuggestion = (opt: string) => {
        if (!textareaRef.current) return;
        const cursor = textareaRef.current.selectionStart;
        const textBefore = value.slice(0, cursor);
        const textAfter = value.slice(cursor);

        const lastDollar = textBefore.lastIndexOf('$');

        const newValue = textBefore.slice(0, lastDollar) + opt + textAfter;
        onChange(newValue);
        setShowSuggestions(false);

        // Refocus and place cursor
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = lastDollar + opt.length;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 10);
    };

    // Syntax Highlighting logic
    const renderHighlighted = () => {
        const parts = value.split(/(\{\{.*?\}\})/g);
        return parts.map((part, i) => {
            if (part.startsWith('{{') && part.endsWith('}}')) {
                const inner = part.slice(2, -2);

                // Sub-syntax highlighting within expression
                const tokens = inner.split(/(\$json|\$node|\$execution|\$index|\$item|'[^']*'|"[^"]*")/g);
                const highlightInner = tokens.map((token, j) => {
                    if (token === '$json') return <span key={j} style={{ color: '#ff0080' }}>{token}</span>;
                    if (token === '$node') return <span key={j} style={{ color: '#7928ca' }}>{token}</span>;
                    if (token === '$execution') return <span key={j} style={{ color: '#0070f3' }}>{token}</span>;
                    if (token === '$index' || token === '$item') return <span key={j} style={{ color: '#eb5757' }}>{token}</span>;
                    if (token.startsWith("'") || token.startsWith('"')) return <span key={j} style={{ color: '#3291ff' }}>{token}</span>;
                    return <span key={j}>{token}</span>;
                });

                return (
                    <span key={i} style={{
                        color: '#333',
                        background: 'rgba(0, 112, 243, 0.08)',
                        fontWeight: 600,
                        borderRadius: '4px',
                        display: 'inline-block',
                        padding: '0 2px'
                    }}>
                        <span style={{ color: '#0070f3', opacity: 0.5 }}>{'{{'}</span>
                        {highlightInner}
                        <span style={{ color: '#0070f3', opacity: 0.5 }}>{'}}'}</span>
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <div style={{
                position: 'relative',
                minHeight: multiline ? '80px' : '36px',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                {/* Highlight Layer */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
                    wordBreak: 'break-all',
                    color: 'transparent',
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}>
                    {renderHighlighted()}
                </div>

                {/* Input Layer */}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder={placeholder}
                    rows={multiline ? 4 : 1}
                    style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        background: 'transparent',
                        color: '#333',
                        caretColor: '#333',
                        outline: 'none',
                        resize: multiline ? 'vertical' : 'none',
                        boxSizing: 'border-box',
                        display: 'block',
                        lineHeight: '1.4'
                    }}
                />
            </div>

            {/* Validation & Preview Layer */}
            {(error || previewValue !== undefined) && (
                <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: error ? '#fff5f5' : '#f8f9fa',
                    border: `1px solid ${error ? '#ffc1c1' : '#e0e0e0'}`,
                    borderRadius: '6px',
                    fontSize: '11px'
                }}>
                    {error ? (
                        <div style={{ color: '#e53e3e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontWeight: 700 }}>⚠️ Error:</span> {error}
                        </div>
                    ) : (
                        <div style={{ color: '#4a5568' }}>
                            <span style={{ fontWeight: 700, color: '#0070f3', textTransform: 'uppercase', fontSize: '10px' }}>Result Preview:</span>
                            <div style={{
                                marginTop: '4px',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                padding: '4px',
                                background: '#fff',
                                borderRadius: '4px',
                                border: '1px solid #eee'
                            }}>
                                {typeof previewValue === 'object' ? JSON.stringify(previewValue, null, 2) : String(previewValue)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && filteredOptions.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: suggestionPos.top,
                    left: suggestionPos.left,
                    zIndex: 1000,
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    width: '240px'
                }}>
                    {filteredOptions.map((opt, i) => (
                        <div
                            key={opt}
                            onClick={() => insertSuggestion(opt)}
                            style={{
                                padding: '8px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                background: i === suggestionIndex ? '#f0f7ff' : 'white',
                                color: i === suggestionIndex ? '#0070f3' : '#333',
                                borderBottom: '1px solid #f5f5f5'
                            }}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
