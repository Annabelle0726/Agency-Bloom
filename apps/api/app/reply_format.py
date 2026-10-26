"""Plain visible text from the bounded Markdown subset supported by Chat."""
import re


def inline_text(text, depth=0):
    out, i = [], 0
    while i < len(text):
        if text[i] == '\\' and i + 1 < len(text):
            out.append(text[i + 1])
            i += 2
            continue
        if text[i] == '`':
            end = text.find('`', i + 1)
            if end > i + 1:
                out.append(text[i + 1:end])
                i = end + 1
                continue
        link = re.match(r'!?\[([^\]\n]+)\]\([^\n)]*\)', text[i:])
        if link and depth < 8:
            out.append(inline_text(link[1], depth + 1))
            i += len(link[0])
            continue
        marker = next((m for m in ('**', '__', '==', '*', '_')
                       if text.startswith(m, i) and text.find(m, i + len(m)) > i + len(m)), None)
        if marker and depth < 8:
            end = text.find(marker, i + len(marker))
            out.append(inline_text(text[i + len(marker):end], depth + 1))
            i = end + len(marker)
            continue
        out.append(text[i])
        i += 1
    return ''.join(out)


def speech_text(content):
    lines, fenced = [], False
    for line in content.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        if re.match(r'^\s*```', line):
            fenced = not fenced
            continue
        if fenced:
            lines.append(line)
            continue
        line = re.sub(r'^ {0,3}#{1,6}\s+', '', line)
        line = re.sub(r'^\s*>\s?', '', line)
        line = re.sub(r'^\s*[-+*]\s+', '• ', line)
        line = re.sub(r'^\s*(\d+)[.)]\s+', r'\1. ', line)
        lines.append(inline_text(line))
    return '\n'.join(lines).strip()
