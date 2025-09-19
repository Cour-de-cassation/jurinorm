import { compile } from "html-to-text"

const convert = compile(
    {
        wordwrap: false,
        preserveNewlines: true,
        selectors: [
            {
                selector: '*',
                options: {
                    ignoreHref: true,
                },
            },
            {
                selector: 'img',
                format: 'skip',
            },
            {
                selector: 'a',
                format: 'inline',
            },
            {
                selector: 'span',
                format: 'inline',
            },
            {
                selector: 'strong',
                format: 'inline',
            },
            {
                selector: 'em',
                format: 'inline',
            },
            {
                selector: 'i',
                format: 'inline',
            },
            {
                selector: 'b',
                format: 'inline',
            },
            {
                selector: 'u',
                format: 'inline',
            },
            {
                selector: 'small',
                format: 'inline',
            },
            {
                selector: 'sub',
                format: 'inline',
            },
            {
                selector: 'sup',
                format: 'inline',
            },
            {
                selector: 'h1',
                options: {
                    uppercase: false,
                },
            },
            {
                selector: 'h2',
                options: {
                    uppercase: false,
                },
            },
            {
                selector: 'h3',
                options: {
                    uppercase: false,
                },
            },
            {
                selector: 'h4',
                options: {
                    uppercase: false,
                },
            },
            {
                selector: 'h5',
                options: {
                    uppercase: false,
                },
            },
            {
                selector: 'h6',
                options: {
                    uppercase: false,
                },
            },
        ],
    }
)

export function htmlToPlainText(html: string) {
    return convert(html)
}