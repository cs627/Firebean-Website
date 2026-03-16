import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: "url('https://picsum.photos/seed/vibrant/1920/1080?blur=4')" }}
        referrerPolicy="no-referrer"
      ></div>

      <main className="relative z-10 container mx-auto px-8 py-24 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div className="text-left">
          <h1 className="text-7xl font-bold tracking-tighter uppercase">
            We don't just stage events; 
            <span className="text-red-500">we architect public engagement.</span>
          </h1>
          <p className="mt-8 text-xl text-neutral-300 max-w-xl italic">
            Pioneering the Professional Playground in Hong Kong since 2007. We bridge the gap between institutional rigor and lifestyle resonance.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-transparent">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h2 className="text-red-500 font-bold uppercase tracking-widest mb-4 border-b-2 border-red-500/30 pb-2">Who We Help</h2>
              <ul className="space-y-2 text-neutral-300">
                <li>Government & Public Sector</li>
                <li>Lifestyle & Consumer</li>
                <li>F&B & Hospitality</li>
                <li>Malls & Venues</li>
              </ul>
            </div>
            <div>
              <h2 className="text-red-500 font-bold uppercase tracking-widest mb-4 border-b-2 border-red-500/30 pb-2">What We Do</h2>
              <ul className="space-y-2 text-neutral-300">
                <li>Roving Exhibitions</li>
                <li>Social & Content</li>
                <li>Interactive & Tech</li>
                <li>PR & Media</li>
                <li>Events & Ceremonies</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
