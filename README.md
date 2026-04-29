# HTML2JSON Parser

## Overview

This project implements a custom `html2json` parser that converts HTML strings into a structured JSON representation.

The parser is built **from scratch without using any DOM parsing libraries**, as required by the assignment.
It follows a **stream-based parsing approach**, inspired by how browsers process HTML internally.

---

## 🚀 Live Demo

You can view the working demo here:  
👉 https://yurii-ilkevych.github.io/jito-intern-test-task/

## Key Features

* ✅ Custom **Finite State Machine (FSM) tokenizer**
* ✅ **SAX-style parsing pipeline**
* ✅ **Stack-based tree construction**
* ✅ **Tolerant parsing** (graceful handling of malformed HTML)
* ✅ Support for:

  * Nested elements
  * Mixed content (text + elements)
  * Comments (`<!-- -->`)
  * Doctype
  * Raw text elements (`<script>`, `<style>`, `<textarea>`)
* ✅ Advanced attribute parsing:

  * double-quoted (`class="btn"`)
  * single-quoted (`id='test'`)
  * unquoted (`type=text`)
  * boolean (`disabled`)
  * duplicate attributes → normalized into arrays
* ✅ Entity decoding (`&lt;`, `&#123;`, `&#x1F600;`)
* ✅ Auto-closing rules for common tags (`<li>`, `<p>`, `<td>`, `<tr>`)
* ✅ Configurable parsing behavior (strict vs tolerant mode)

---

## Architecture

The parser is designed as a pipeline:

```
HTML Input
   ↓
Tokenizer (FSM)
   ↓
Token Stream (SAX-style events)
   ↓
Tree Builder (stack-based)
   ↓
JSON AST
```

### 1. Tokenizer

A character-by-character tokenizer that converts the input string into tokens:

* `tag_open`
* `tag_close`
* `text`
* `comment`
* `doctype`

This stage handles:

* attribute parsing
* malformed syntax
* raw-text elements
* whitespace normalization

---

### 2. Tree Builder

A stack-based parser that constructs the final JSON structure.

Key behaviors:

* Maintains a node stack
* Handles mismatched and missing closing tags
* Implements auto-closing rules
* Recovers from malformed HTML

---

### 3. Output Format

Each node in the resulting JSON follows a consistent structure:

```json
{
  "type": "element",
  "tag": "div",
  "attributes": {
    "class": ["container", "main"],
    "disabled": true
  },
  "children": []
}
```

Text nodes:

```json
{
  "type": "text",
  "content": "Hello world"
}
```

---

## Handling Edge Cases

This parser is designed to handle a wide range of real-world HTML scenarios:

### Supported cases

* Deeply nested structures
* Multiple root nodes (wrapped into a synthetic root)
* Broken HTML:

  * unclosed tags
  * incorrectly nested elements
  * extra closing tags
* Attributes:

  * malformed attributes
  * missing values
  * duplicate attributes
* Raw content:

  * `<script>` with HTML-like content inside
  * `<style>` with special characters
* Whitespace variations
* HTML entities

### Example of recovery

```html
<div><span></div>
```

The parser will automatically fix the structure by closing `<span>` before `<div>`.

---

## Configuration

The parser supports optional configuration:

```js
html2json(html, {
  tolerant: true,          // default: true
  strict: false,           // throw errors on invalid HTML
  preserveWhitespace: false,
  decodeEntities: true
});
```

---

## Limitations

* This is not a full HTML5 specification-compliant parser
* Namespace handling (SVG/MathML) is simplified
* Some browser-specific parsing quirks are approximated

---

## How to Use

```js
const result = html2json('<div class="app">Hello <b>world</b></div>');
console.log(JSON.stringify(result, null, 2));
```

---

## Project Structure

```
html2json.js        # Main parser implementation
html_samples/       # Test HTML files
index.html          # Provided demo file
ai_help/            # AI usage evidence (required)
```

---

## AI Usage

AI tools were used as required by the assignment for:

* architectural guidance
* edge case identification
* iterative improvements

Full conversation history is included in:

```
ai_help/chatgpt_chat.txt
```

---

## Final Notes

The focus of this implementation was **robustness and correctness over simplicity**.

The parser is designed to:

* never crash on valid or semi-valid HTML
* handle real-world messy inputs
* maintain a clean and extensible architecture

---
