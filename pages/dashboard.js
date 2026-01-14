import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function Dashboard() {
  const [files, setFiles] = useState([]);
  const [docs, setDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);


  const fileInputRef = useRef(null);

  /* ---------------- Fetch docs ---------------- */

  const fetchDocs = async () => {
    try {
      const { data } = await axios.get("/api/docs");
      setDocs((data.documents || []).filter(d => d.file_name));
    } catch {
      setDocs([]);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  /* ---------------- Upload ---------------- */

  const handleUpload = async () => {
    if (!files.length) return;

    const formData = new FormData();
    files.forEach(f => formData.append("file", f));

    try {
      await axios.post("/api/upload", formData);
      setFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // ✅ THIS clears filename
      }

      fetchDocs();
    } catch {
      alert("Upload failed");
    }
  };

  /* ---------------- Delete ---------------- */

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;

    try {
      await axios.delete("/api/docs", {
        data: { documentId: doc.id },
      });
      fetchDocs();
    } catch {
      alert("Failed to delete document");
    }
  };

  /* ---------------- Chat ---------------- */

  const handleSend = async () => {
    if (!query.trim() || loading) return;

    const userText = query;
    setMessages(prev => [...prev, { role: "user", text: userText }]);
    setQuery("");
    setLoading(true);

    try {
      const { data } = await axios.post("/api/chat", { question: userText });

      setMessages(prev => [
        ...prev,
        {
          role: "bot",
          text: data.answer,
          sources: data.sources || [],
          faithfulness: data.faithfulness ?? 0,
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "bot", text: "⚠️ Failed to answer.", sources: [], faithfulness: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout">
      {/* ---------------- SIDEBAR ---------------- */}
      <aside className="sidebar">
        <h2>📄 Documents</h2>

        <div className="docList">
          {docs.length === 0 && (
            <div className="empty">No documents uploaded</div>
          )}

          {docs.map(doc => (
            <div key={doc.id} className="docItem">
              <div className="docName" title={doc.file_name}>
                {doc.file_name}
              </div>

              <div className="docActions">
                {doc.signed_url && (
                  <a href={doc.signed_url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                )}
                <button
                  className="deleteBtn"
                  onClick={() => handleDelete(doc)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="uploadBox">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={e => setFiles([...e.target.files])}
          />

          <button disabled={!files.length} onClick={handleUpload}>
            Upload
          </button>
        </div>
      </aside>

      {/* ---------------- CHAT ---------------- */}
      <main className="chat">
        <header>💬 Chat with your documents</header>

        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              <div>{m.text}</div>

              {m.role === "bot" && (
                <>
                  <div className="meta">
                    Faithfulness:{" "}
                    <b
                      style={{
                        color:
                          m.faithfulness >= 70
                            ? "#15803d"
                            : m.faithfulness >= 40
                              ? "#ca8a04"
                              : "#b91c1c",
                      }}
                    >
                      {m.faithfulness}%
                    </b>
                  </div>

                  <details className="sources">
                    <summary>Sources ({m.sources.length})</summary>

                    {m.sources.length === 0 ? (
                      <div className="muted">
                        No sources were directly cited.
                      </div>
                    ) : (
                      m.sources.map((s, idx) => (
                        <div key={idx} className="sourceItem">
                          <div className="chunk">{s.chunk_text}</div>
                          <div className="sourceMeta">
                            {s.file_name}
                            {s.signed_url && (
                              <>
                                {" "}
                                —{" "}
                                <a
                                  href={s.signed_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </details>
                </>
              )}
            </div>
          ))}

          {loading && (
            <div className="bubble bot typing">
              Thinking<span>.</span><span>.</span><span>.</span>
            </div>
          )}
        </div>

        <footer className="inputBar">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask something…"
            onKeyDown={e => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend} disabled={loading}>
            Send
          </button>
        </footer>
      </main>

      {/* ---------------- STYLES ---------------- */}
      <style jsx>{`
        .layout {
          display: flex;
          height: 100vh;
          font-family: system-ui, sans-serif;
        }

        .sidebar {
          width: 320px;
          border-right: 1px solid #ddd;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }

        .docList {
          flex: 1;
          overflow-y: auto;
        }

        .docItem {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          border: 1px solid #eee;
          border-radius: 6px;
          margin-bottom: 8px;
          background: #fafafa;
        }

        .docName {
          flex: 1;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .docActions {
          display: flex;
          gap: 8px;
        }

        .deleteBtn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
        }

        .uploadBox {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .chat {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        header {
          padding: 12px 16px;
          border-bottom: 1px solid #ddd;
          font-weight: 600;
        }

        .messages {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          background: #f6f7f9;
        }

        .bubble {
          max-width: 70%;
          padding: 10px 12px;
          border-radius: 10px;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .bubble.user {
          background: #dbeafe;
          align-self: flex-end;
        }

        .bubble.bot {
          background: #fff;
          border: 1px solid #eee;
          align-self: flex-start;
        }

        .meta {
          margin-top: 6px;
          font-size: 12px;
          color: #555;
        }

        .sources {
          margin-top: 8px;
          padding: 8px;
          border: 1px dashed #ddd;
          border-radius: 6px;
          background: #fafafa;
          font-size: 12px;
        }

        .sourceItem {
          border-left: 3px solid #ddd;
          padding-left: 8px;
          margin-top: 6px;
        }

        .typing span {
          animation: blink 1.4s infinite both;
        }

        .typing span:nth-child(2) { animation-delay: .2s }
        .typing span:nth-child(3) { animation-delay: .4s }

        @keyframes blink {
          0% { opacity: .2 }
          20% { opacity: 1 }
          100% { opacity: .2 }
        }

        .inputBar {
          display: flex;
          padding: 12px;
          border-top: 1px solid #ddd;
        }

        .inputBar input {
          flex: 1;
          padding: 8px;
          margin-right: 8px;
        }

        .muted {
          color: #777;
        }
      `}</style>
    </div>
  );
}
