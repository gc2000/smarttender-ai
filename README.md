# SmartTender AI v1.4

SmartTender AI is an intelligent procurement assistant designed to streamline the creation of professional tender documents (RFPs/RFQs). It leverages the Google Gemini API to analyze user purchasing requirements via a natural language chat interface, identify the industry domain, and generate structured, compliant tender specifications.

## 🚀 Key Features

*   **AI-Powered Requirement Analysis**: Chat with an AI agent to define your needs. The system automatically extracts key requirements, estimates budgets, and identifies the procurement domain (e.g., IT, Medical, Construction).
*   **Domain-Specific Templates**: Automatically applies industry-standard templates based on the identified domain, complete with specific sections like "Data Security" for IT or "HSE Compliance" for Construction.
*   **Smart Clause Library**: Automatically injects mandatory standard legal and technical clauses (e.g., GDPR, Anti-Bribery, Warranty) into the document based on the domain.
*   **Dynamic Document Generation**: Generates full tender drafts in Markdown format with automatic structuring.
*   **Draft Editing & Export**: 
    *   Edit the generated draft directly within the application.
    *   Download as **Markdown (.md)** or **Microsoft Word (.docx)**.
*   **Project Management**:
    *   Save multiple projects to local storage.
    *   Track document status (Draft, Review, Approved, Rejected).
    *   Auto-save functionality.
*   **Configuration Editor**: A built-in settings interface to customize Tender Templates and the Clause Library without touching code.
*   **Responsive UI**: Resizable split-pane layout with collapsible sidebar for optimal viewing on different screen sizes.

## 🛠 Tech Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS
*   **AI Engine**: Google Gemini API (`@google/genai`)
*   **Document Handling**: 
    *   `docx` for Word export
    *   `marked` for Markdown rendering
*   **Storage**: Browser LocalStorage (No backend required)

## 📦 Installation & Setup

This project is currently structured for a browser-native ES Module environment (no build step required for the provided single-file structure). However, for local development, it is recommended to set it up using Vite.

### Prerequisites
*   Node.js (v18+)
*   Google Gemini API Key

### Steps to Run (Standard React/Vite Setup)

1.  **Initialize Project**:
    ```bash
    npm create vite@latest smart-tender -- --template react-ts
    cd smart-tender
    npm install
    ```

2.  **Install Dependencies**:
    ```bash
    npm install @google/genai uuid docx marked
    # Dev dependencies
    npm install -D tailwindcss postcss autoprefixer
    npx tailwindcss init -p
    ```

3.  **Environment Configuration**:
    Create a `.env` file in the root directory and add your API key:
    ```env
    VITE_GEMINI_API_KEY=your_actual_api_key_here
    ```
    *Note: In the provided source code, update `process.env.API_KEY` to `import.meta.env.VITE_GEMINI_API_KEY` in `services/geminiService.ts`.*

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 📖 Usage Guide

1.  **Start a Chat**: Describe what you want to buy (e.g., "I need to buy 500 office chairs" or "I need an SAP maintenance contract").
2.  **Analyze**: Click **"Analyze Requirements"**. The AI will extract key points and select a template.
3.  **Customize Structure**: In the right panel, add, move, or delete sections of the proposed tender structure.
4.  **Generate**: Click **"Generate Document"**. The AI will write the full content, injecting standard clauses where appropriate.
5.  **Review & Edit**: Switch to "Edit" mode to tweak the text.
6.  **Export**: Download the final result as a `.docx` file for official use.
7.  **Manage**: Use the "My Projects" menu to save your work and come back later.

## ⚙️ Configuration

You can customize the underlying logic by clicking the **Settings (Gear Icon)** in the header:
*   **Templates**: Modify the default structure, focus areas, and keywords for any domain.
*   **Clause Library**: Add, edit, or remove standard clauses that get automatically inserted into tenders.