import React, { useState, useEffect } from 'react';
import Dexie from 'dexie';
import { Folder, Edit3, Eye, Plus, Trash2, Download, Play, Save } from 'lucide-react';

// ডেটাবেস সেটআপ
const db = new Dexie('MutuTeXDatabase');
db.version(1).stores({
  projects: '++id, name, content, lastModified'
});

const DEFAULT_LATEX = `\\documentclass{article}
\\usepackage{fontspec}
\\setmainfont{FreeSerif} 
\\usepackage{chemfig}

\\begin{document}
Hello from Mutu TeX Studio Pro! 

Here is a water molecule:
\\chemfig{H_2O}
\\end{document}`;

export default function MutuTeXStudio() {
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [code, setCode] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    const allProjects = await db.projects.toArray();
    setProjects(allProjects);
  };

  const handleCreateProject = async () => {
    const name = prompt('Project Name:', 'New Project');
    if (!name) return;
    const newProject = { name, content: DEFAULT_LATEX, lastModified: new Date().toISOString() };
    const id = await db.projects.add(newProject);
    await loadProjects();
    openProject({ ...newProject, id });
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this project?')) {
      await db.projects.delete(id);
      if (currentProject?.id === id) {
        setCurrentProject(null); setCode(''); setPdfUrl(null);
      }
      loadProjects();
    }
  };

  const openProject = (project) => {
    setCurrentProject(project); setCode(project.content);
    setPdfUrl(null); setError(''); setActiveTab('editor');
  };

  const saveProject = async () => {
    if (!currentProject) return;
    await db.projects.update(currentProject.id, { content: code, lastModified: new Date().toISOString() });
    loadProjects();
  };

  // আপডেটেড কম্পাইল ফাংশন (FormData এর বদলে URLSearchParams ব্যবহার করা হয়েছে)
  const compileLaTeX = async () => {
    if (!code.trim()) return;
    setIsCompiling(true); setError('');
    await saveProject();

    try {
      // URLSearchParams ডেটাকে এনকোড করে পাঠায়, যা সার্ভারের বুঝতে সুবিধা হয়
      const params = new URLSearchParams();
      params.append('filecontents', code);
      params.append('engine', 'xelatex'); 
      params.append('return', 'pdf');

      const response = await fetch('/api/compile', {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error('Compilation Failed. সার্ভার এরর বা কোডে ভুল আছে।');
      }
      
      const blob = await response.blob();
      
      // চেক করা হচ্ছে সার্ভার আসলেই PDF দিয়েছে কিনা
      if (blob.type !== 'application/pdf') {
         throw new Error('সার্ভার PDF তৈরি করতে পারেনি। আপনার ল্যাটেক্স কোডটি চেক করুন।');
      }

      setPdfUrl(URL.createObjectURL(blob));
      setActiveTab('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-[#00f3ff] font-sans">
      <header className="p-4 bg-[#111111] shadow-md border-b border-[#00f3ff]/20 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-wider">Mutu TeX Pro</h1>
        {activeTab === 'editor' && currentProject && (
          <div className="flex gap-3">
            <button onClick={saveProject} className="p-2 bg-[#050505] rounded-lg border border-[#00f3ff]/30 hover:bg-[#00f3ff]/10">
              <Save size={18} />
            </button>
            <button onClick={compileLaTeX} disabled={isCompiling} className="px-4 py-2 bg-[#00f3ff] text-[#050505] font-bold rounded-lg flex items-center gap-2 opacity-90 hover:opacity-100 disabled:opacity-50">
              {isCompiling ? 'Compiling...' : <><Play size={18} /> Compile</>}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'projects' && (
          <div className="p-4 h-full overflow-y-auto">
            <button onClick={handleCreateProject} className="w-full mb-6 p-4 border-2 border-dashed border-[#00f3ff]/50 rounded-xl flex justify-center items-center gap-2 hover:bg-[#00f3ff]/5 transition">
              <Plus size={24} /> <span>Create New Project</span>
            </button>
            <div className="space-y-3">
              {projects.map(p => (
                <div key={p.id} onClick={() => openProject(p)} className="p-4 bg-[#111111] rounded-xl border border-[#00f3ff]/10 flex justify-between items-center cursor-pointer hover:border-[#00f3ff]/50 transition">
                  <div>
                    <h3 className="font-semibold text-lg">{p.name}</h3>
                    <p className="text-xs text-[#00f3ff]/50">Last modified: {new Date(p.lastModified).toLocaleString()}</p>
                  </div>
                  <button onClick={(e) => handleDeleteProject(p.id, e)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="h-full flex flex-col p-2">
            {error && <div className="bg-red-900/50 text-red-200 p-2 text-sm rounded mb-2">{error}</div>}
            {!currentProject ? (
              <div className="flex-1 flex items-center justify-center text-[#00f3ff]/50">Please open a project first.</div>
            ) : (
              <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="flex-1 w-full bg-[#111111] text-[#e0e0e0] font-mono p-4 rounded-xl border border-[#00f3ff]/20 focus:outline-none focus:border-[#00f3ff] resize-none" placeholder="Enter LaTeX code here..." />
            )}
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="h-full relative bg-white">
            {pdfUrl ? (
              <><iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Preview" /><a href={pdfUrl} download={`${currentProject?.name || 'document'}.pdf`} className="absolute bottom-6 right-6 p-4 bg-[#00f3ff] text-[#050505] rounded-full shadow-lg shadow-[#00f3ff]/20 hover:scale-105 transition"><Download size={24} /></a></>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 bg-[#111111]">
                {isCompiling ? 'Generating PDF...' : 'No PDF generated yet.'}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="bg-[#111111] border-t border-[#00f3ff]/20 flex justify-around p-3 pb-safe">
        <NavButton active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} icon={<Folder />} label="Projects" />
        <NavButton active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} icon={<Edit3 />} label="Editor" />
        <NavButton active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Eye />} label="Preview" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 w-20 transition-colors ${active ? 'text-[#00f3ff]' : 'text-[#00f3ff]/40 hover:text-[#00f3ff]/70'}`}>
      {React.cloneElement(icon, { size: 24 })}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  );
}
