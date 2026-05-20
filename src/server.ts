import fs from "node:fs/promises";
import path from "node:path";
import { marked, Renderer, Tokens } from "marked";
import pc from "picocolors";
import open from "open";
import { createServer } from "node:http";

const DEFAULT_PORT = 3000;

// Custom renderer for mermaid code blocks
function createMermaidRenderer(): Partial<Renderer> {
  return {
    code(token: Tokens.Code): string {
      const code = token.text || '';
      const lang = token.lang || '';
      
      // Check if this is a mermaid code block
      if (lang === 'mermaid') {
        // Escape the code for embedding in HTML
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<div class="mermaid">${escapedCode}</div>`;
      }
      
      // Default code block handling
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre><code>${escapedCode}</code></pre>`;
    }
  };
}

export async function serve(filePath: string): Promise<void> {
  // Validate file exists
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read file content
  const content = await fs.readFile(filePath, "utf-8");
  const html = await marked.parse(content);
  
  const fileName = path.basename(filePath);
  const page = buildPage(html, fileName);

  // Create HTTP server
  const server = createServer((req, res) => {
    const url = new URL(req.url || "", `http://localhost:${DEFAULT_PORT}`);
    
    // Serve markdown file for download
    if (url.pathname === "/download.md") {
      res.writeHead(200, {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      });
      res.end(content);
      return;
    }
    
    // Default: serve HTML page
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(page);
  });

  // Use default port
  const port = DEFAULT_PORT;

  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => {
      resolve();
    });
  });

  const baseUrl = `http://localhost:${port}`;
  
  console.log(pc.green(`✨ Server running at ${pc.cyan(baseUrl)}`));
  console.log(pc.yellow(`📄 Serving: ${path.basename(filePath)}`));
  console.log(pc.dim("Press Ctrl+C to stop\n"));

  // Open browser
  await open(baseUrl);

  // Keep server running
  await new Promise<void>((resolve) => {
    const shutdown = () => {
      console.log(pc.yellow("\n👋 Shutting down server..."));
      server.close(() => resolve());
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

function buildPage(htmlContent: string, fileName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fileName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    :root {
      --bg-primary: #ffffff;
      --text-primary: #111111;
      --text-secondary: #666666;
      --text-tertiary: #888888;
      --border-light: #e5e5e5;
      --border-subtle: #f0f0f0;
      --content-width: 720px;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 18px;
      line-height: 1.6;
      color: var(--text-primary);
      background: var(--bg-primary);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      padding-bottom: 60px;
    }

    /* ==================== HEADER ==================== */
    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-light);
    }

    .header-inner {
      max-width: var(--content-width);
      margin: 0 auto;
      padding: 0 24px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-tertiary);
      text-decoration: none;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .logo-icon {
      width: 18px;
      height: 18px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Width Control */
    .width-control {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
      position: relative;
    }

    .width-control:hover {
      background: #f5f5f5;
    }

    .width-control svg {
      width: 16px;
      height: 16px;
      color: var(--text-tertiary);
    }

    .width-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 8px 0;
      min-width: 160px;
      display: none;
      z-index: 200;
    }

    .width-dropdown.show {
      display: block;
    }

    .width-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 0.85rem;
      color: var(--text-secondary);
      transition: background 0.15s;
    }

    .width-option:hover {
      background: #f5f5f5;
    }

    .width-option.active {
      color: var(--text-primary);
      font-weight: 500;
    }

    .width-option svg {
      width: 14px;
      height: 14px;
      opacity: 0.5;
    }

    .width-option.active svg {
      opacity: 1;
      color: var(--text-primary);
    }

    .width-preview {
      width: 100%;
      height: 2px;
      background: var(--border-light);
      border-radius: 1px;
    }

    .width-option.active .width-preview {
      background: var(--text-primary);
    }

    /* Export Button */
    .export-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
      background: none;
      border: 1px solid var(--border-light);
      transition: all 0.2s;
      position: relative;
    }

    .export-btn:hover {
      background: #f5f5f5;
      color: var(--text-primary);
      border-color: var(--text-tertiary);
    }

    .export-btn svg {
      width: 16px;
      height: 16px;
    }

    .export-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 6px 0;
      min-width: 150px;
      display: none;
      z-index: 200;
    }

    .export-dropdown.show {
      display: block;
    }

    .export-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 0.85rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: background 0.15s;
    }

    .export-option:hover {
      background: #f5f5f5;
      color: var(--text-primary);
    }

    .export-option svg {
      width: 16px;
      height: 16px;
      opacity: 0.6;
    }

    /* ==================== MAIN CONTENT ==================== */
    .container {
      max-width: var(--content-width);
      margin: 0 auto;
      padding: 48px 24px 120px;
    }

    /* ==================== ARTICLE HEADER ==================== */
    .article-header {
      margin-bottom: 48px;
    }

    .article-category {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-tertiary);
      margin-bottom: 12px;
    }

    .article-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 2.75rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
    }

    .article-subtitle {
      font-size: 1.125rem;
      font-weight: 400;
      color: var(--text-secondary);
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .article-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.85rem;
      color: var(--text-tertiary);
      padding-top: 24px;
      border-top: 1px solid var(--border-light);
    }

    .meta-author {
      font-weight: 500;
      color: var(--text-secondary);
    }

    .meta-divider {
      width: 4px;
      height: 4px;
      background: var(--border-light);
      border-radius: 50%;
    }

    .meta-date, .meta-read-time {
      color: var(--text-tertiary);
    }

    /* ==================== ARTICLE CONTENT ==================== */
    .article-content {
      font-size: 1.0625rem;
      line-height: 1.75;
    }

    .article-content p {
      margin-bottom: 28px;
      color: var(--text-primary);
    }

    .article-content h2 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-top: 64px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-light);
      line-height: 1.3;
    }

    .article-content h3 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-top: 48px;
      margin-bottom: 20px;
      line-height: 1.35;
    }

    .article-content h4 {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-top: 32px;
      margin-bottom: 16px;
    }

    .article-content a {
      color: var(--text-primary);
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-thickness: 1px;
      transition: opacity 0.2s;
    }

    .article-content a:hover {
      opacity: 0.7;
    }

    .article-content strong {
      font-weight: 700;
      color: var(--text-primary);
    }

    .article-content em {
      font-style: italic;
    }

    .article-content blockquote {
      margin: 40px 0;
      padding: 0;
      border-left: none;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.375rem;
      font-weight: 400;
      font-style: italic;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .article-content blockquote p {
      margin-bottom: 0;
    }

    .article-content ul, .article-content ol {
      margin: 24px 0 32px;
      padding-left: 0;
      list-style: none;
    }

    .article-content li {
      position: relative;
      padding-left: 24px;
      margin-bottom: 12px;
      color: var(--text-primary);
    }

    .article-content ul li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10px;
      width: 6px;
      height: 6px;
      background: var(--text-primary);
      border-radius: 50%;
    }

    .article-content ol {
      counter-reset: list;
    }

    .article-content ol li {
      counter-increment: list;
    }

    .article-content ol li::before {
      content: counter(list) '.';
      position: absolute;
      left: 0;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .article-content hr {
      border: none;
      margin: 56px auto;
      width: 100%;
      height: 1px;
      background: var(--border-light);
    }

    .article-content code {
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      font-size: 0.875em;
      background: var(--bg-primary);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--text-primary);
      border: 1px solid var(--border-light);
    }

    .article-content pre {
      background: #fafafa;
      border: 1px solid var(--border-light);
      border-radius: 12px;
      padding: 28px;
      margin: 36px 0;
      overflow-x: auto;
    }

    .article-content pre code {
      background: transparent;
      padding: 0;
      font-size: 0.9em;
      line-height: 1.7;
      border: none;
      color: var(--text-primary);
    }

    .article-content table {
      width: 100%;
      margin: 36px 0;
      border-collapse: collapse;
      font-size: 0.9375rem;
    }

    .article-content th, .article-content td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border-light);
    }

    .article-content th {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.8125rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .article-content tr:hover td {
      background: #fafafa;
    }

    .article-content img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 36px 0;
      border: 1px solid var(--border-light);
    }

    /* ==================== MERMAID DIAGRAMS ==================== */
    .article-content .mermaid {
      background: #fafafa;
      border: 1px solid var(--border-light);
      border-radius: 12px;
      padding: 32px;
      margin: 36px 0;
      text-align: center;
      overflow-x: auto;
    }

    .article-content .mermaid svg {
      max-width: 100%;
      height: auto;
    }

    /* Mermaid pre-rendered */
    .mermaid-pre {
      display: none;
    }

    .mermaid svg {
      max-width: 100%;
      height: auto;
    }

    /* ==================== FIXED FOOTER ==================== */
    .site-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 32px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-top: 1px solid var(--border-light);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
    }

    .site-footer span {
      font-size: 0.7rem;
      color: var(--text-tertiary);
    }

    /* ==================== SCROLL PROGRESS ==================== */
    .progress-bar {
      position: fixed;
      top: 56px;
      left: 0;
      height: 2px;
      background: var(--text-primary);
      width: 0%;
      transition: width 0.1s ease;
      z-index: 99;
    }

    /* ==================== RESPONSIVE ==================== */
    @media (max-width: 768px) {
      .article-title {
        font-size: 2.25rem;
      }

      .article-content h2 {
        font-size: 1.5rem;
      }

      .container {
        padding: 32px 20px 100px;
      }
    }

    @media print {
      .progress-bar, .site-header, .site-footer {
        display: none !important;
      }
      body {
        font-size: 12pt;
        line-height: 1.5;
        padding-bottom: 0;
      }
      .article-title {
        font-size: 24pt;
      }
    }
  </style>
</head>
<body>
  <div class="progress-bar" id="progress"></div>
  
  <!-- Header -->
  <header class="site-header">
    <div class="header-inner">
      <a href="#" class="logo">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        DOCS
      </a>
      <div class="header-right">
        <!-- Width Control -->
        <div class="width-control" id="widthControl" onclick="toggleWidthDropdown()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 6H3M21 12H3M21 18H3"/>
          </svg>
          <div class="width-dropdown" id="widthDropdown">
            <div class="width-option" onclick="setWidth(480, event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>
                <div>Narrow</div>
                <div class="width-preview" style="width: 60%"></div>
              </div>
            </div>
            <div class="width-option active" onclick="setWidth(720, event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>
                <div>Default</div>
                <div class="width-preview" style="width: 80%"></div>
              </div>
            </div>
            <div class="width-option" onclick="setWidth(960, event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>
                <div>Wide</div>
                <div class="width-preview" style="width: 100%"></div>
              </div>
            </div>
            <div class="width-option" onclick="setWidth(1200, event)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>
                <div>Full Width</div>
                <div class="width-preview" style="width: 120%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Export Button -->
        <button class="export-btn" id="exportBtn" onclick="toggleExportDropdown()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-left:2px">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <div class="export-dropdown" id="exportDropdown">
            <a href="/download.md" class="export-option">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Markdown
            </a>
            <div class="export-option" onclick="window.print()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              PDF
            </div>
          </div>
        </button>
      </div>
    </div>
  </header>

  <main>
    <article class="container">
      <header class="article-header">
        <div class="article-category" id="articleCategory">ARTICLE</div>
        <h1 class="article-title" id="articleTitle">${escapeHtml(fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))}</h1>
        <p class="article-subtitle" id="articleSubtitle">Previewing markdown content with elegant typography</p>
        <div class="article-meta">
          <span class="meta-author">Document Viewer</span>
          <span class="meta-divider"></span>
          <span class="meta-date" id="articleDate"></span>
          <span class="meta-divider"></span>
          <span class="meta-read-time" id="readTime"></span>
        </div>
      </header>
      
      <div class="article-content">
        ${htmlContent}
      </div>
    </article>
  </main>

  <!-- Fixed Footer -->
  <footer class="site-footer">
    <span>Document Viewer © ${new Date().getFullYear()}</span>
  </footer>

  <script>
    // Mermaid configuration for version 11.x
    mermaid.init({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        primaryColor: '#fafafa',
        primaryBorderColor: '#e5e5e5',
        primaryTextColor: '#111111',
        lineColor: '#888888',
        secondaryColor: '#ffffff',
        tertiaryColor: '#f5f5f5',
        nodeBorder: '#888888',
        clusterBorders: '#888888'
      },
      flowchart: {
        curve: 'basis',
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 80,
        htmlLabels: true
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 20,
        actorMargin: 80,
        width: 180,
        height: 50,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 40,
        mirrorActors: false,
        bottomMarginAdj: 1,
        useMaxWidth: true
      },
      state: {
        dividerMargin: 10,
        sizeUnit: 5,
        padding: 8,
        textHeight: 10,
        titleShift: -15,
        noteMargin: 10,
        forkWidth: 14,
        forkHeight: 7,
        miniPadding: 2,
        fontSizeFactor: 5.02,
        fontSize: 24,
        labelHeight: 16,
        edgeLength: 80,
        compositTitleSize: 35
      },
      securityLevel: 'loose'
    });

    // Render all mermaid diagrams
    document.addEventListener('DOMContentLoaded', () => {
      const mermaidElements = document.querySelectorAll('.article-content .mermaid');
      if (mermaidElements.length > 0) {
        mermaid.run({ nodes: [...mermaidElements] });
      }
    });

    // Also try to render immediately in case DOM is already loaded
    window.addEventListener('load', () => {
      const mermaidElements = document.querySelectorAll('.article-content .mermaid');
      if (mermaidElements.length > 0 && mermaidElements[0].getAttribute('data-processed')) {
        return;
      }
      mermaid.run({ nodes: [...mermaidElements] });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      const widthControl = document.getElementById('widthControl');
      const exportBtn = document.getElementById('exportBtn');
      const widthDropdown = document.getElementById('widthDropdown');
      const exportDropdown = document.getElementById('exportDropdown');

      if (widthControl && !widthControl.contains(e.target)) {
        widthDropdown?.classList.remove('show');
      }
      if (exportBtn && !exportBtn.contains(e.target)) {
        exportDropdown?.classList.remove('show');
      }
    });

    function toggleWidthDropdown() {
      const dropdown = document.getElementById('widthDropdown');
      const exportDropdown = document.getElementById('exportDropdown');
      dropdown?.classList.toggle('show');
      exportDropdown?.classList.remove('show');
    }

    function toggleExportDropdown() {
      const dropdown = document.getElementById('exportDropdown');
      const widthDropdown = document.getElementById('widthDropdown');
      dropdown?.classList.toggle('show');
      widthDropdown?.classList.remove('show');
    }

    function setWidth(width, event) {
      event.stopPropagation();
      document.documentElement.style.setProperty('--content-width', width + 'px');
      
      // Update active state
      document.querySelectorAll('.width-option').forEach(opt => {
        opt.classList.remove('active');
      });
      event.currentTarget.classList.add('active');
      
      // Close dropdown
      document.getElementById('widthDropdown')?.classList.remove('show');
    }

    // Set article date
    const date = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('articleDate').textContent = date.toLocaleDateString('en-US', options);

    // Estimate reading time
    const text = document.body.innerText;
    const wordCount = text.trim().split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);
    document.getElementById('readTime').textContent = readingTime + ' min read';

    // Scroll progress
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      document.getElementById('progress').style.width = progress + '%';
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}