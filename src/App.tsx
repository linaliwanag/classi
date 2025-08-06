import React from "react";
import BuildInputForm from "./components/BuildInputForm";

const App: React.FC = () => {
  return (
    <main className="min-h-screen bg-white text-gray-900 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-2">Classi 🎲</h1>
      <p className="mb-6 text-center max-w-xl">
        Describe your character concept, and Classi will generate a complete level 1–12 Baldur's Gate 3 build with roleplay flavor and mechanical synergy.
      </p>
      <BuildInputForm />
    </main>
  );
};

export default App;
