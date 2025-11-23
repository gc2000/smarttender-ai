import React, { useState, useEffect, useRef } from 'react';
import { TenderAnalysis, PurchaseDomain, TenderStatus } from '../types';
import { generateTenderDraft } from '../services/geminiService';
import { getStandardClauses } from '../config/clauseLibrary';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { marked } from 'marked';

interface AnalysisPanelProps {
  analysis: TenderAnalysis | null;
  isLoading: boolean;
  onSave?: (name: string, structure: string[], draft: string | null) => void;
  initialProjectName?: string | null;
  initialDraft?: string | null;
  status?: TenderStatus;
  onStatusChange?: (status: TenderStatus) => void;
}

const getDomainColor = (domain: PurchaseDomain) => {
  switch (domain) {
    case PurchaseDomain.IT: return 'bg-blue-100 text-blue-800 border-blue-200';
    case PurchaseDomain.Medical: return 'bg-red-100 text-red-800 border-red-200';
    case PurchaseDomain.Construction: return 'bg-orange-100 text-orange-800 border-orange-200';
    case PurchaseDomain.Logistics: return 'bg-green-100 text-green-800 border-green-200';
    case PurchaseDomain.Furniture: return 'bg-amber-100 text-amber-800 border-amber-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusColor = (status: TenderStatus) => {
  switch (status) {
    case TenderStatus.Draft: return 'bg-gray-100 text-gray-600';
    case TenderStatus.Review: return 'bg-yellow-100 text-yellow-800';
    case TenderStatus.Approved: return 'bg-green-100 text-green-800';
    case TenderStatus.Rejected: return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

// Helper to re-number sections when one is deleted or moved
const reindexSections = (sections: string[]): string[] => {
  return sections.map((section, index) => {
    const expectedNum = index + 1;
    const match = section.match(/^\s*(\d+)\./);
    if (!match) return section;
    
    const currentNum = parseInt(match[1]);
    if (currentNum === expectedNum) return section;

    const regex = new RegExp(`^(\\s*)${currentNum}\\.`, 'gm');
    return section.replace(regex, `$1${expectedNum}.`);
  });
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  analysis, 
  isLoading, 
  onSave, 
  initialProjectName, 
  initialDraft, 
  status = TenderStatus.Draft, 
  onStatusChange 
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  
  // Ref for scrolling to save input
  const saveSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (analysis && analysis.structure) {
      setSections(analysis.structure);
      
      // Initialize draft
      setDraft(initialDraft || null);
      
      // Use the initial name if provided (e.g. from loaded project), otherwise clear
      setProjectName(initialProjectName || ''); 
    }
  }, [analysis, initialProjectName, initialDraft]);

  const handleGenerateDraft = async () => {
    if (!analysis) return;
    setIsGenerating(true);
    const text = await generateTenderDraft(analysis, sections);
    
    setDraft(text);
    setIsGenerating(false);
    setViewMode('preview'); // Auto switch to preview on generation

    // Auto-save if we have a project name
    if (onSave && projectName.trim()) {
      onSave(projectName, sections, text);
    }
  };

  const handleSaveClick = () => {
    setIsSaving(true);
    // Scroll to the save section to ensure user sees the input
    setTimeout(() => {
      saveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const confirmSave = () => {
    if (onSave && projectName.trim()) {
      onSave(projectName, sections, draft);
      setIsSaving(false);
    }
  };

  const handleDownloadDraft = () => {
    if (!draft) return;
    const blob = new Blob([draft], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'tender-draft'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = async () => {
    if (!draft) return;

    const lines = draft.split('\n');
    const children: Paragraph[] = [];

    // Helper to parse inline formatting (bold)
    const parseText = (text: string) => {
        // Split by ** for bold. e.g., "Text **bold** text" -> ["Text ", "bold", " text"]
        const parts = text.split('**');
        return parts.map((part, index) => new TextRun({
            text: part,
            bold: index % 2 === 1 // Odd indices are inside ** **
        }));
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        // Preserve empty lines as empty paragraphs
        if (!trimmed) {
             children.push(new Paragraph({}));
             return;
        }

        // Handle Headings (levels 1-6)
        // Use regex to capture hashes and content: ^(#{1,6})\s+(.*)$
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        
        if (headingMatch) {
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            
            let headingLevel = HeadingLevel.HEADING_1;
            switch (level) {
                case 1: headingLevel = HeadingLevel.HEADING_1; break;
                case 2: headingLevel = HeadingLevel.HEADING_2; break;
                case 3: headingLevel = HeadingLevel.HEADING_3; break;
                case 4: headingLevel = HeadingLevel.HEADING_4; break;
                case 5: headingLevel = HeadingLevel.HEADING_5; break;
                case 6: headingLevel = HeadingLevel.HEADING_6; break;
                default: headingLevel = HeadingLevel.HEADING_1;
            }

            children.push(new Paragraph({
                heading: headingLevel,
                children: parseText(content)
            }));
            return;
        }

        // Handle Bullet Points
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
             // Determine indentation level (roughly) based on leading whitespace in original line
            let indentLevel = 0;
            if (line.startsWith('      ') || line.startsWith('\t\t')) indentLevel = 2;
            else if (line.startsWith('   ') || line.startsWith('\t')) indentLevel = 1;

             children.push(new Paragraph({
                bullet: { level: indentLevel },
                children: parseText(trimmed.substring(2))
            }));
            return;
        }

        // Regular Paragraph
        children.push(new Paragraph({
            children: parseText(trimmed)
        }));
    });

    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    try {
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName || 'tender-draft'}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error generating docx", error);
        alert("Failed to generate Word document.");
    }
  };

  const handleSectionChange = (index: number, value: string) => {
    const newSections = [...sections];
    newSections[index] = value;
    setSections(newSections);
  };

  const handleDeleteSection = (index: number) => {
    const remaining = sections.filter((_, i) => i !== index);
    const reindexed = reindexSections(remaining);
    setSections(reindexed);
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || 
        (direction === 'down' && index === sections.length - 1)) return;

    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    
    // Reindex
    const reindexed = reindexSections(newSections);
    setSections(reindexed);
  };

  const handleAddSection = () => {
    const nextNum = sections.length + 1;
    const newSection = `${nextNum}. New Section Title
   ${nextNum}.1 Sub-section
      ${nextNum}.1.1 Detailed requirement`;
    setSections([...sections, newSection]);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 animate-pulse">
        <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <p>Analyzing requirements...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center px-6">
        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <h3 className="text-lg font-medium text-gray-600">Tender Intelligence</h3>
        <p className="text-sm mt-2">Chat with the agent to describe your needs. Click "Analyze Request" to generate a smart summary and template.</p>
      </div>
    );
  }

  const activeClauses = getStandardClauses(analysis.domain);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 relative">
      
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {initialProjectName ? `Project: ${initialProjectName}` : 'Analysis Result'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {initialProjectName ? 'Editing saved tender structure.' : 'AI-extracted insights from conversation.'}
          </p>
        </div>
        {/* Status Badge */}
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>

      {/* Domain Badge */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Identified Domain</span>
        <div className="mt-2 flex items-center justify-between">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getDomainColor(analysis.domain)}`}>
            {analysis.domain}
          </span>
        </div>
        <p className="mt-3 text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">
          "{analysis.reasoning}"
        </p>
      </div>

      {/* Key Points */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Key Requirements</span>
        <ul className="mt-3 space-y-2">
          {analysis.keyPoints.map((point, idx) => (
            <li key={idx} className="flex items-start text-sm text-gray-700">
              <span className="mr-2 text-indigo-500">•</span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Standard Clauses Section */}
      {activeClauses.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Standard Clauses Applied</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeClauses.map((clause) => (
              <div key={clause.id} className="group relative cursor-help">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                  {clause.title}
                </span>
                {/* Tooltip */}
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  {clause.content}
                  <svg className="absolute text-gray-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Structure Editor */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tender Structure</span>
          <span className="text-[10px] text-gray-400">Drag/Edit to customize</span>
        </div>
        <div className="space-y-3">
          {sections.map((section, idx) => (
            <div key={idx} className="relative group">
              <textarea
                rows={section.split('\n').length + 1}
                className="w-full p-2 pr-16 text-xs text-gray-700 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none font-mono"
                value={section}
                onChange={(e) => handleSectionChange(idx, e.target.value)}
              />
              {/* Action Buttons */}
              <div className="absolute top-2 right-2 flex flex-col space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleMoveSection(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 bg-white rounded shadow hover:bg-gray-50 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move Up"
                >
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button
                  onClick={() => handleMoveSection(idx, 'down')}
                  disabled={idx === sections.length - 1}
                  className="p-1 bg-white rounded shadow hover:bg-gray-50 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move Down"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button
                  onClick={() => handleDeleteSection(idx)}
                  className="p-1 bg-white rounded shadow hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  title="Remove Section"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddSection}
          className="mt-3 w-full py-1.5 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-indigo-300 hover:text-indigo-600 font-medium transition-colors"
        >
          + Add New Section
        </button>
      </div>

      {/* Recommendation & Actions */}
      <div ref={saveSectionRef} className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-sm">
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Recommended Template</span>
        <h3 className="mt-1 text-lg font-semibold text-indigo-900">{analysis.recommendedTemplate}</h3>
        
        {/* Save Name Input Popover */}
        {isSaving && (
          <div className="mt-4 bg-white p-3 rounded-lg border border-indigo-200 shadow-sm animate-fade-in-down">
             <label className="block text-xs font-medium text-gray-700 mb-1">Project Name</label>
             <div className="flex gap-2">
                <input 
                  type="text" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Q3 Office Expansion"
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white text-gray-900"
                  autoFocus
                />
                <button 
                  onClick={confirmSave}
                  disabled={!projectName.trim()}
                  className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button 
                   onClick={() => setIsSaving(false)}
                   className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs"
                >
                  Cancel
                </button>
             </div>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button 
            onClick={handleSaveClick}
            disabled={isSaving || isGenerating}
            className="flex-1 py-2 px-4 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
             Save Project
          </button>

          <button 
            onClick={handleGenerateDraft}
            disabled={isGenerating || isSaving}
            className="flex-[2] py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {isGenerating ? (
              <>Generating...</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Generate Document
              </>
            )}
          </button>
        </div>
      </div>

      {/* Workflow Actions */}
      {onStatusChange && draft && (
        <div className="mt-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
           <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Workflow Actions</span>
           <div className="flex gap-3">
              {status === TenderStatus.Draft && (
                <button 
                  onClick={() => onStatusChange(TenderStatus.Review)}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  Submit for Review
                </button>
              )}
              
              {(status === TenderStatus.Review || status === TenderStatus.Rejected) && (
                 <>
                   <button 
                    onClick={() => onStatusChange(TenderStatus.Approved)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                   >
                     Approve
                   </button>
                   <button 
                    onClick={() => onStatusChange(TenderStatus.Rejected)}
                    disabled={status === TenderStatus.Rejected}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                   >
                     Reject
                   </button>
                 </>
              )}

              {status === TenderStatus.Approved && (
                <div className="flex-1 flex items-center justify-center gap-2 text-green-700 bg-green-50 py-2 rounded-lg border border-green-200 font-medium text-sm">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                   Document Approved
                </div>
              )}
           </div>
        </div>
      )}

      {/* Draft Preview Modal / Section */}
      {draft && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-4">
           <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Draft Preview</span>
            <div className="flex items-center gap-2">
               {/* Save Button */}
               <button 
                  onClick={handleSaveClick}
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 px-2 py-1 border border-indigo-100 rounded bg-indigo-50 mr-2"
                  title="Save to Project"
               >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  Save
               </button>

               {/* View Mode Toggle */}
               <div className="flex bg-gray-100 rounded p-0.5 mr-2">
                  <button 
                    onClick={() => setViewMode('preview')}
                    className={`px-2 py-0.5 text-xs rounded transition-all ${viewMode === 'preview' ? 'bg-white shadow text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Preview
                  </button>
                  <button 
                    onClick={() => setViewMode('edit')}
                    className={`px-2 py-0.5 text-xs rounded transition-all ${viewMode === 'edit' ? 'bg-white shadow text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Edit
                  </button>
               </div>

               <button onClick={handleDownloadDraft} className="text-xs text-gray-500 hover:text-indigo-600 hover:underline flex items-center gap-1 px-2 py-1 border border-gray-200 rounded bg-gray-50">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  .md
               </button>
               <button onClick={handleDownloadDocx} className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 px-2 py-1 border border-blue-100 rounded bg-blue-50">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  .docx
               </button>
               <button onClick={() => setDraft(null)} className="text-xs text-red-500 hover:underline ml-2">Close</button>
            </div>
           </div>
           
           <div className="bg-gray-50 p-0 rounded border border-gray-100">
             {viewMode === 'preview' ? (
               <div 
                 className="prose max-w-none p-6 text-sm bg-white h-[65vh] min-h-[500px] overflow-y-auto [&_hr]:hidden prose-headings:mt-4 prose-p:mb-2"
                 dangerouslySetInnerHTML={{ __html: marked.parse(draft || '') }}
               />
             ) : (
               <textarea
                  className="w-full h-[65vh] min-h-[500px] font-mono text-xs text-gray-700 bg-gray-50 p-4 border-0 outline-none resize-none"
                  value={draft || ''}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  placeholder="Edit your markdown here..."
               />
             )}
           </div>
        </div>
      )}

    </div>
  );
};

export default AnalysisPanel;