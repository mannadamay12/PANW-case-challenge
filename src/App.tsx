import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-white mb-8">
        MindScribe
      </h1>
      <p className="text-slate-400 mb-8">
        Your local-first AI journaling companion
      </p>

      <form
        className="flex gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          className="px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-blue-500"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter your name..."
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Greet
        </button>
      </form>

      {greetMsg && (
        <p className="mt-6 text-green-400">{greetMsg}</p>
      )}
    </main>
  );
}

export default App;
