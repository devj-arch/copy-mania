# 🚀 Copy Mania  
**Copy folders like a pro — straight from VS Code!**

Copy Mania is a lightweight Visual Studio Code extension that lets you **right-click any folder** and instantly copy all its files (or export them to markdown) in a structured, easy-to-read format — perfect for sharing code with AI tools like ChatGPT, refactoring help, or documentation.

---

## 🧠 Why I built this
I often needed to paste several related files into ChatGPT to debug or refactor code.  
Doing that manually was messy — switching between files, copying snippets, and organizing them.  
So I thought, *“What if VS Code could do that in one click?”*  
That’s how **Copy Mania** was born.

---

## ✨ Features
- 🗂️ **Right-click any folder** → copy or export its contents  
- 🔁 Option to include or exclude subfolders  
- 🧩 **Automatically ignores** unwanted folders and files:
node_modules, .git, dist, build, .env, lock files, images, etc.
- 🧠 Outputs everything as **structured markdown**, e.g.:
```markdown
--- file: src/index.js ---
```js
console.log("Hello World");
```

- 📋 Copy directly to clipboard or save as `.md` file
- ⚙️ Fully customizable ignore list in VS Code settings

---

## ⚙️ Tech Stack
- **TypeScript**
- **VS Code API**
- **Node.js (fs, path)**
- **Regex-based filtering & recursive directory traversal**

---

## 🧩 How to Use
1. Clone the repo or open it in VS Code.
2. Press `F5` to run the extension in **Extension Development Host**.
3. Right-click on any folder in the Explorer →  
 Select **“Copy Folder (Structured)”** or **“Copy Top-Level Only.”**
4. Choose between:
 - 📋 Copy to Clipboard  
 - 💾 Export to Markdown

---

## ⚠️ Safety & File Filtering
Copy Mania automatically skips files and folders that are usually **unnecessary, sensitive, or large**, including:
.env, .env.*, node_modules, .git, dist, build, package-lock.json, yarn.lock, pnpm-lock.yaml


It also ignores **binary or media files** such as:
*.png, *.jpg, *.jpeg, *.gif, *.svg, *.ico, *.pdf,
*.zip, *.tar, *.gz, *.rar, *.mp3, *.mp4, *.mov, *.avi, *.webm, *.wav


This helps:
- ⚡ Keep the output lightweight  
- 🔒 Prevent accidental exposure of secrets or large assets  
- ✨ Focus only on code and text-based files  

All ignore patterns are customizable under:
Settings → Extensions → Copy Mania → Ignore Names

---

## 📽️ Demo
![CopyManiaVSCodeExtension-ezgif com-video-to-gif-converter](https://github.com/user-attachments/assets/658bf237-f50b-47a4-9da8-1be093826926)


---

## 🚧 Roadmap
- [ ] Publish to VS Code Marketplace  
- [ ] Add light/dark icons  
- [ ] Option to include/exclude file types manually  
- [ ] (Future) Direct integration with AI tools (ChatGPT, Claude, etc.)

---

## 🧑‍💻 Author
**Dev Joshi**  
📬 [LinkedIn](https://www.linkedin.com/in/dev-joshi-b07410324/)  
💡 “Just a dev having fun automating the small stuff.”

---

## 🪪 License
MIT License © 2025 Dev Joshi  

---

### 📦 Short Repo Description
> A simple and customizable VS Code extension that lets you copy entire folder contents (with structure) into markdown — perfect for sharing or pasting into LLMs.
