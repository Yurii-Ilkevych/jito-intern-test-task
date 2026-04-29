function convertHtml2JsonAndSet() {
  const htmlTextAreaValue = document.getElementById("html").value;
  const jsonObj = html2json(htmlTextAreaValue);
  const jsonArea = document.getElementById("json");
  jsonArea.textContent = JSON.stringify(jsonObj, null, 2);
}

/* 
  Update this function to convert html into json object.
  You can rewrite it completely, just be sure it accepts htmlText as string and outputs json object.
*/
function html2json(html, options = {}) {
  const config = {
    tolerant: true,
    preserveWhitespace: false,
    decodeEntities: true,
    strict: false,
    ...options
  };

  const VOID = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
  ]);

  const RAW = new Set(["script", "style", "textarea"]);

  const AUTO_CLOSE = {
    li: new Set(["li"]),
    p: new Set(["p", "div"]),
    td: new Set(["td", "th"]),
    th: new Set(["td", "th"]),
    tr: new Set(["tr"])
  };

  function decodeEntities(str) {
    if (!config.decodeEntities) return str;
    return str
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
        String.fromCharCode(parseInt(n, 16))
      );
  }

  function createNode(type, props = {}) {
    return { type, ...props, children: [] };
  }

  function normalizeAttrs(attrs) {
    const res = {};
    for (const k in attrs) {
      const v = attrs[k];
      if (res[k]) {
        res[k] = Array.isArray(res[k]) ? [...res[k], v] : [res[k], v];
      } else {
        res[k] = v === "" ? true : v;
      }
    }
    return res;
  }

  // ================= TOKENIZER =================

  function tokenize(input) {
    const tokens = [];
    let i = 0;

    function peek(n = 0) {
      return input[i + n];
    }

    function consume() {
      return input[i++];
    }

    function readWhile(fn) {
      let str = "";
      while (i < input.length && fn(peek())) {
        str += consume();
      }
      return str;
    }

    function skipWhitespace() {
      readWhile(c => /\s/.test(c));
    }

    function readUntil(str) {
      const idx = input.indexOf(str, i);
      if (idx === -1) {
        const rest = input.slice(i);
        i = input.length;
        return rest;
      }
      const out = input.slice(i, idx);
      i = idx + str.length;
      return out;
    }

    function readAttrValue() {
      if (peek() === '"' || peek() === "'") {
        const quote = consume();
        const val = readWhile(c => c !== quote);
        consume();
        return val;
      }
      return readWhile(c => !/\s|>/.test(c));
    }

    function readAttributes() {
      const attrs = {};
      while (i < input.length && peek() !== ">" && peek() !== "/") {
        skipWhitespace();
        const name = readWhile(c => /[^\s=/>]/.test(c));
        if (!name) break;

        let value = "";

        skipWhitespace();
        if (peek() === "=") {
          consume();
          skipWhitespace();
          value = readAttrValue();
        }

        attrs[name] = value;
      }
      return normalizeAttrs(attrs);
    }

    while (i < input.length) {
      if (input.startsWith("<!--", i)) {
        i += 4;
        const content = readUntil("-->");
        tokens.push({ type: "comment", content });
        continue;
      }

      if (/<!DOCTYPE/i.test(input.slice(i, i + 9))) {
        const content = readUntil(">");
        tokens.push({ type: "doctype", content: "<!" + content + ">" });
        continue;
      }

      if (peek() === "<") {
        if (peek(1) === "/") {
          i += 2;
          const name = readWhile(c => /[^\s>]/.test(c)).toLowerCase();
          readUntil(">");
          tokens.push({ type: "tag_close", name });
          continue;
        }

        consume(); // <
        const name = readWhile(c => /[^\s/>]/.test(c)).toLowerCase();

        const attrs = readAttributes();

        let selfClosing = false;
        if (peek() === "/") {
          selfClosing = true;
          consume();
        }

        consume(); // >

        tokens.push({
          type: "tag_open",
          name,
          attributes: attrs,
          selfClosing: selfClosing || VOID.has(name)
        });

        // RAW TEXT MODE
        if (RAW.has(name)) {
          const content = readUntil(`</${name}>`);
          tokens.push({
            type: "text",
            content
          });
          tokens.push({
            type: "tag_close",
            name
          });
        }

        continue;
      }

      const text = readWhile(c => c !== "<");
      const normalized = config.preserveWhitespace
        ? text
        : text.replace(/\s+/g, " ");

      if (normalized.trim()) {
        tokens.push({
          type: "text",
          content: decodeEntities(normalized)
        });
      }
    }

    return tokens;
  }

  // ================= TREE BUILDER =================

  function buildTree(tokens) {
    const root = createNode("root");
    const stack = [root];

    function current() {
      return stack[stack.length - 1];
    }

    function autoClose(tag) {
      if (!AUTO_CLOSE[tag]) return;
      const set = AUTO_CLOSE[tag];
      const top = current();
      if (top.tag && set.has(top.tag)) {
        stack.pop();
      }
    }

    for (const token of tokens) {
      switch (token.type) {
        case "doctype":
          current().children.push({
            type: "doctype",
            content: token.content
          });
          break;

        case "comment":
          current().children.push({
            type: "comment",
            content: token.content
          });
          break;

        case "text":
          current().children.push({
            type: "text",
            content: token.content
          });
          break;

        case "tag_open": {
          autoClose(token.name);

          const node = createNode("element", {
            tag: token.name,
            attributes: token.attributes
          });

          current().children.push(node);

          if (!token.selfClosing) {
            stack.push(node);
          }
          break;
        }

        case "tag_close": {
          let found = false;

          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].tag === token.name) {
              stack.length = i;
              found = true;
              break;
            }
          }

          if (!found && config.strict) {
            throw new Error(`Unexpected closing tag: ${token.name}`);
          }

          break;
        }
      }
    }

    return root;
  }

  const tokens = tokenize(html);
  return buildTree(tokens);
}

function showExample1() {
  const htmlExample = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport">
    <title>Sample HTML</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>Welcome to My Website</h1>
    </header>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
    </nav>
    <main>
        <section id="home">
            <h2>Home Section</h2>
            <p>This is the home section of the webpage.</p>
        </section>
        <section id="about">
            <h2>About Section</h2>
            <p>This is the about section of the webpage.</p>
        </section>
    </main>
    <footer>
        <p>&copy; 2024 My Website</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>
`;
  const jsonContent = {
    "Comment 1":
      "You have to think about how to take into account various html inputs so your json structure will cover them all and handle different cases.",
    "Comment 2":
      "When you make any choice in terms of selecting specific json structure for conversion - be ready to provide reasoning behind such choice.",
  };

  document.getElementById("html").value = htmlExample;
  document.getElementById("json").textContent = JSON.stringify(
    jsonContent,
    null,
    2
  );
}

function showExample2() {
  const htmlExample = `<div>
<p>Hello world!</p>
  <button>Click me!</button>
  <textarea>Some very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long string.</textarea>
</div>
`;
  const jsonContent = {
    "Comment 1":
      "You have to think about how to take into account various html inputs so your json structure will cover them all and handle different cases.",
    "Comment 2":
      "When you make any choice in terms of selecting specific json structure for conversion - be ready to provide reasoning behind such choice.",
  };

  document.getElementById("html").value = htmlExample;
  document.getElementById("json").textContent = JSON.stringify(
    jsonContent,
    null,
    2
  );
}
