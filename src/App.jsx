import React, { useState, useEffect } from 'react';
import Dexie from 'dexie';
import { Folder, Edit3, Eye, Plus, Trash2, Download, Play, Save } from 'lucide-react';

const db = new Dexie('MutuTeXDatabase');
db.version(1).stores({
  projects: '++id, name, content, lastModified'
});

const DEFAULT_LATEX = `\\documentclass{article}
\\usepackage{fontspec}
\\IfFontExistsTF{Noto Serif Bengali}
  {\\setmainfont{Noto Serif Bengali}}
  {\\setmainfont{FreeSerif}}

\\usepackage{chemfig}

\\begin{document}
বাংলা টেস্ট 😏

Here is a water molecule:
\\chemfig{H_2O}

\\end{document}`;

export default function App() {
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [code, setCode] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const loadProjects = async () => {
    const data = await db.projects.toArray();
    data.sort((a,b)=> new Date(b.lastModified)-new Date(a.lastModified));
    setProjects(data);
  };

  const createProject = async () => {
    const name = prompt("Project name", "New Project");
    if (!name) return;

    const id = await db.projects.add({
      name,
      content: DEFAULT_LATEX,
      lastModified: new Date().toISOString()
    });

    const proj = { id, name, content: DEFAULT_LATEX };
    setCurrentProject(proj);
    setCode(proj.content);
    setActiveTab('editor');
    loadProjects();
  };

  const saveProject = async () => {
    if (!currentProject) return;
    await db.projects.update(currentProject.id, {
      content: code,
      lastModified: new Date().toISOString()
    });
    loadProjects();
  };

  const compileLaTeX = async () => {
    setIsCompiling(true);
    setError('');

    try {
      const form = new FormData();
      form.append('filename[]', 'main.tex');
      form.append('filecontents[]', code);
      form.append('engine', 'xelatex');
      form.append('return', 'pdf');

      const res = await fetch('/api/compile', {
        method: 'POST',
        body: form
      });

      if (!res.ok) throw new Error('Compile failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setPdfUrl(url);
      setActiveTab('preview');

    } catch (err) {
      setError(err.message);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="p-3 bg-black flex justify-between">
        <h1>Mutu TeX Pro</h1>

        {activeTab === 'editor' && (
          <div className="flex gap-2">
            <button onClick={saveProject}><Save size={18}/></button>
            <button onClick={compileLaTeX}><Play size={18}/></button>
          </div>
        )}
      </header>

      <main className="flex-1">
        {activeTab === 'projects' && (
          <div className="p-4">
            <button onClick={createProject}>+ New Project</button>

            {projects.map(p => (
              <div key={p.id} onClick={()=>{
                setCurrentProject(p);
                setCode(p.content);
                setActiveTab('editor');
              }}>
                {p.name}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'editor' && (
          <textarea
            value={code}
            onChange={e=>setCode(e.target.value)}
            className="w-full h-full bg-black text-white"
          />
        )}

        {activeTab === 'preview' && pdfUrl && (
          <iframe src={pdfUrl} className="w-full h-full"/>
        )}
      </main>

      <nav className="flex justify-around p-2 bg-black">
        <button onClick={()=>setActiveTab('projects')}><Folder/></button>
        <button onClick={()=>setActiveTab('editor')}><Edit3/></button>
        <button onClick={()=>setActiveTab('preview')}><Eye/></button>
      </nav>
    </div>
  );
}
