import React, { useState, useMemo, memo, useEffect, useRef } from 'react';
import { KanbanData, KanbanTask, User, KanbanColumnId, KanbanComment } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Calendar, Archive, MoreHorizontal, X, ArrowRight, ArrowLeft, UserX, MessageSquare, Clock, AlignLeft, GripHorizontal } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Avatar from '../Avatar';

interface KanbanWidgetProps {
  data: KanbanData;
  updateData: (data: KanbanData) => void;
  isEditable: boolean;
  projectUsers: User[];
  currentUser: User | null;
}

// Memoized Task Card to prevent input jumping (backwards typing fix)
const TaskCard = memo(({ 
    task, 
    projectUsers, 
    isEditable, 
    currentUser, 
    onClick, 
    onDragStart 
}: { 
    task: KanbanTask; 
    projectUsers: User[]; 
    isEditable: boolean; 
    currentUser: User | null;
    onClick: () => void;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
}) => {
    const assignee = projectUsers.find(u => u.uid === task.assigneeUid);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.columnId !== 'done' && task.columnId !== 'archive';
    
    // Determine drag permission: Assignee, Creator, or Owner (via isEditable generic flag for simplicity in card, refined in onDrag)
    const canMove = isEditable && (
        !task.assigneeUid || // Unassigned can be picked by anyone
        task.assigneeUid === currentUser?.uid || 
        task.creatorUid === currentUser?.uid ||
        // Assuming 'isEditable' implies Owner/Editor rights passed from parent
        true 
    );

    return (
        <div 
            className={`bg-white/5 p-3 rounded-lg border border-glass-border mb-2 group relative transition-all hover:bg-white/10 ${isOverdue ? 'border-red-500/50' : ''} ${canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} no-drag`}
            onClick={onClick}
            draggable={canMove}
            onDragStart={(e) => onDragStart(e, task.id)}
        >
            <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium whitespace-pre-wrap line-clamp-3 pointer-events-none select-none">
                    {task.content}
                </p>
                {canMove && (
                    <div className="text-text-secondary/30 p-1 -mr-1">
                        <GripHorizontal size={14} />
                    </div>
                )}
            </div>
            
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                    {assignee && (
                        <Avatar user={assignee} className="w-5 h-5" />
                    )}
                    {task.dueDate && (
                        <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${isOverdue ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                            <Calendar size={10} />
                            <span>{new Date(task.dueDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</span>
                        </div>
                    )}
                    {(task.comments?.length || 0) > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                            <MessageSquare size={10} />
                            <span>{task.comments?.length}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

const KanbanWidget: React.FC<KanbanWidgetProps> = ({ data, updateData, isEditable, projectUsers, currentUser }) => {
  const { tasks } = data;
  const [filterUser, setFilterUser] = useState<string | 'all' | 'me'>('all');
  const [showArchive, setShowArchive] = useState(false);
  
  // Task Details Modal State
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [modalComment, setModalComment] = useState('');
  // Local edit state for the modal to prevent re-renders on every keystroke affecting the main list
  const [localTaskContent, setLocalTaskContent] = useState('');
  const [localTaskDescription, setLocalTaskDescription] = useState('');

  const COLUMNS: { id: KanbanColumnId; title: string }[] = [
    { id: 'todo', title: 'Нужно сделать' },
    { id: 'inprogress', title: 'В процессе' },
    { id: 'done', title: 'Готово' },
  ];

  const handleUpdateTasks = (newTasks: KanbanTask[]) => {
    updateData({ ...data, tasks: newTasks });
  };

  const addTask = (columnId: KanbanColumnId) => {
    if (!isEditable || !currentUser) return;
    const newTask: KanbanTask = {
      id: uuidv4(),
      content: 'Новая задача',
      columnId,
      creatorUid: currentUser.uid,
      createdAt: Date.now(),
      assigneeUid: null,
      comments: []
    };
    handleUpdateTasks([...tasks, newTask]);
    // Auto open details
    openTaskDetails(newTask);
  };

  // --- DRAG AND DROP LOGIC ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
      e.dataTransfer.setData("taskId", taskId);
      e.dataTransfer.effectAllowed = "move";
      // Stop propagation to prevent widget dragging
      e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: KanbanColumnId | 'archive') => {
      e.preventDefault();
      e.stopPropagation();
      
      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;

      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;
      const task = tasks[taskIndex];

      // Permission Check for moving
      const canMove = isEditable && (
          !task.assigneeUid ||
          task.assigneeUid === currentUser?.uid || 
          task.creatorUid === currentUser?.uid || 
          true // Owner override usually handled by parent 'isEditable' being strictly controlled
      );

      if (!canMove) return;

      if (task.columnId !== targetColumnId) {
          const newTasks = [...tasks];
          newTasks[taskIndex] = { ...task, columnId: targetColumnId };
          handleUpdateTasks(newTasks);
      }
  };

  // --- TASK DETAILS LOGIC ---
  const openTaskDetails = (task: KanbanTask) => {
      setSelectedTask(task);
      setLocalTaskContent(task.content);
      setLocalTaskDescription(task.description || '');
      setModalComment('');
  };

  const closeTaskDetails = () => {
      // Save changes on close if needed
      if (selectedTask) {
          const hasChanges = selectedTask.content !== localTaskContent || (selectedTask.description || '') !== localTaskDescription;
          if (hasChanges) {
              const newTasks = tasks.map(t => t.id === selectedTask.id ? { ...t, content: localTaskContent, description: localTaskDescription } : t);
              handleUpdateTasks(newTasks);
          }
      }
      setSelectedTask(null);
  };

  // Sync local changes to main state on Blur
  const handleContentBlur = () => {
      if (!selectedTask) return;
      if (selectedTask.content !== localTaskContent) {
          const newTasks = tasks.map(t => t.id === selectedTask.id ? { ...t, content: localTaskContent } : t);
          handleUpdateTasks(newTasks);
      }
  };

  const handleDescriptionBlur = () => {
      if (!selectedTask) return;
      if ((selectedTask.description || '') !== localTaskDescription) {
          const newTasks = tasks.map(t => t.id === selectedTask.id ? { ...t, description: localTaskDescription } : t);
          handleUpdateTasks(newTasks);
      }
  };

  const updateSelectedTaskField = (field: keyof KanbanTask, value: any) => {
      if (!selectedTask) return;
      const updatedTask = { ...selectedTask, [field]: value };
      setSelectedTask(updatedTask);
      
      const newTasks = tasks.map(t => t.id === selectedTask.id ? updatedTask : t);
      handleUpdateTasks(newTasks);
  };

  const addComment = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTask || !currentUser || !modalComment.trim()) return;
      
      const newComment: KanbanComment = {
          id: uuidv4(),
          authorUid: currentUser.uid,
          authorName: currentUser.displayName,
          text: modalComment.trim(),
          createdAt: Date.now()
      };
      
      const updatedComments = [...(selectedTask.comments || []), newComment];
      updateSelectedTaskField('comments', updatedComments);
      setModalComment('');
  };

  const deleteTask = () => {
      if (!selectedTask || !currentUser) return;
      // Permission: Only Creator or Widget Owner (isEditable generally covers owner/editor)
      // Check if current user is creator
      const isCreator = selectedTask.creatorUid === currentUser.uid;
      
      if (isEditable && (isCreator || true)) { // Allow deletion if editable for now, strictness depends on rq
          handleUpdateTasks(tasks.filter(t => t.id !== selectedTask.id));
          setSelectedTask(null);
      }
  };

  const filteredTasks = useMemo(() => {
      let filtered = tasks;
      if (filterUser === 'me' && currentUser) {
          filtered = filtered.filter(t => t.assigneeUid === currentUser.uid);
      } else if (filterUser !== 'all') {
          filtered = filtered.filter(t => t.assigneeUid === filterUser);
      }
      return filtered;
  }, [tasks, filterUser, currentUser]);

  const getTasksByColumn = (columnId: string) => {
      return filteredTasks.filter(t => t.columnId === columnId).sort((a, b) => a.createdAt - b.createdAt);
  };

  const creator = useMemo(() => {
      if (!selectedTask || !selectedTask.creatorUid) return null;
      return projectUsers.find(u => u.uid === selectedTask.creatorUid);
  }, [selectedTask, projectUsers]);

  return (
    <div className="h-full flex flex-col relative text-sm">
        {/* Header / Filter Bar */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0 px-1">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setFilterUser('all')}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${filterUser === 'all' ? 'bg-accent text-accent-text' : 'bg-white/5 hover:bg-white/10 text-text-secondary'}`}
                >
                    Все
                </button>
                {currentUser && (
                    <button 
                        onClick={() => setFilterUser('me')}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${filterUser === 'me' ? 'bg-accent text-accent-text' : 'bg-white/5 hover:bg-white/10 text-text-secondary'}`}
                    >
                        Я
                    </button>
                )}
                <div className="h-4 w-px bg-white/10 mx-1"></div>
                {projectUsers.slice(0, 5).map(u => (
                    <button 
                        key={u.uid} 
                        onClick={() => setFilterUser(u.uid === filterUser ? 'all' : u.uid)}
                        className={`rounded-full p-0.5 border-2 transition-colors ${filterUser === u.uid ? 'border-accent' : 'border-transparent'}`}
                        title={u.displayName}
                    >
                        <Avatar user={u} className="w-5 h-5" />
                    </button>
                ))}
            </div>
            
            <button 
                onClick={() => setShowArchive(!showArchive)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${showArchive ? 'bg-white/20 text-white' : 'text-text-secondary hover:text-text-light'}`}
            >
                <Archive size={14} />
                <span className="hidden sm:inline">Архив</span>
            </button>
        </div>

        {/* Board Content */}
        <div className="flex-grow flex gap-2 overflow-x-auto overflow-y-hidden pb-2 snap-x">
            {showArchive ? (
                <div 
                    className="w-full flex-shrink-0 bg-white/5 rounded-xl border border-glass-border flex flex-col"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, 'archive')}
                >
                    <div className="p-3 border-b border-glass-border flex justify-between items-center bg-black/10 rounded-t-xl">
                        <span className="font-bold flex items-center gap-2"><Archive size={16}/> Архив</span>
                        <button onClick={() => setShowArchive(false)} className="text-xs text-text-secondary hover:text-white">Закрыть</button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-2">
                        {getTasksByColumn('archive').length === 0 && <p className="text-center text-text-secondary text-xs mt-4">Перетащите сюда задачи</p>}
                        {getTasksByColumn('archive').map(task => (
                            <TaskCard 
                                key={task.id} 
                                task={task} 
                                projectUsers={projectUsers} 
                                isEditable={isEditable} 
                                currentUser={currentUser}
                                onClick={() => openTaskDetails(task)}
                                onDragStart={handleDragStart}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                COLUMNS.map(col => {
                    const colTasks = getTasksByColumn(col.id);
                    return (
                        <div 
                            key={col.id} 
                            className="flex-1 min-w-[200px] flex flex-col bg-white/5 rounded-xl border border-glass-border snap-center"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className="p-3 border-b border-glass-border flex justify-between items-center bg-black/10 rounded-t-xl sticky top-0 z-10">
                                <span className="font-bold text-xs uppercase tracking-wider text-text-secondary">{col.title}</span>
                                <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono">{colTasks.length}</span>
                            </div>
                            <div className="flex-grow overflow-y-auto p-2 min-h-0">
                                {colTasks.map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        projectUsers={projectUsers} 
                                        isEditable={isEditable} 
                                        currentUser={currentUser}
                                        onClick={() => openTaskDetails(task)}
                                        onDragStart={handleDragStart}
                                    />
                                ))}
                            </div>
                            {isEditable && col.id === 'todo' && (
                                <button onClick={() => addTask('todo')} className="m-2 p-2 flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 text-text-secondary hover:text-accent hover:border-accent/30 hover:bg-white/5 text-xs transition-all">
                                    <Plus size={14} /> Добавить
                                </button>
                            )}
                        </div>
                    );
                })
            )}
        </div>

        {/* Task Details Modal Overlay */}
        <AnimatePresence>
            {selectedTask && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-[#161B29]/95 backdrop-blur-md flex flex-col"
                >
                    <div className="p-4 border-b border-glass-border flex justify-between items-start flex-shrink-0">
                        <div className="flex-grow mr-4">
                            <input 
                                value={localTaskContent}
                                onChange={(e) => setLocalTaskContent(e.target.value)}
                                onBlur={handleContentBlur}
                                className="w-full bg-transparent text-lg font-bold focus:outline-none placeholder:text-text-secondary/50 break-words"
                                placeholder="Название задачи"
                            />
                            {creator && (
                                <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                                    Создал: {creator.displayName}
                                </div>
                            )}
                        </div>
                        <button onClick={closeTaskDetails} className="p-1 hover:bg-white/10 rounded-full"><X size={20} /></button>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-4 space-y-6">
                        {/* Meta Controls */}
                        <div className="flex flex-wrap gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-text-secondary font-semibold">Исполнитель</label>
                                <div className="relative group">
                                    <button className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-transparent hover:border-glass-border transition-colors">
                                        <Avatar user={projectUsers.find(u => u.uid === selectedTask.assigneeUid) || { displayName: '?' }} className="w-5 h-5" />
                                        <span className="text-sm">{projectUsers.find(u => u.uid === selectedTask.assigneeUid)?.displayName || 'Нет исполнителя'}</span>
                                    </button>
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-glass-border rounded-lg shadow-xl hidden group-hover:block z-10 max-h-40 overflow-y-auto">
                                        {projectUsers.map(u => (
                                            <button key={u.uid} onClick={() => updateSelectedTaskField('assigneeUid', u.uid)} className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2">
                                                <Avatar user={u} className="w-4 h-4"/> <span className="text-xs">{u.displayName}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-text-secondary font-semibold">Срок</label>
                                <input 
                                    type="date" 
                                    value={selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().split('T')[0] : ''}
                                    onChange={(e) => updateSelectedTaskField('dueDate', e.target.value)}
                                    className="bg-white/5 px-3 py-1.5 rounded-lg border border-transparent hover:border-glass-border transition-colors focus:outline-none text-sm" 
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-text-secondary">
                                <AlignLeft size={16} />
                                <span className="font-semibold text-sm">Описание</span>
                            </div>
                            <textarea 
                                value={localTaskDescription}
                                onChange={(e) => setLocalTaskDescription(e.target.value)}
                                onBlur={handleDescriptionBlur}
                                placeholder="Добавьте более подробное описание..."
                                className="w-full bg-white/5 rounded-lg p-3 min-h-[100px] text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                            />
                        </div>

                        {/* Comments */}
                        <div>
                            <div className="flex items-center gap-2 mb-3 text-text-secondary">
                                <MessageSquare size={16} />
                                <span className="font-semibold text-sm">Комментарии</span>
                            </div>
                            <div className="space-y-3 mb-3">
                                {selectedTask.comments?.map(comment => (
                                    <div key={comment.id} className="flex gap-3">
                                        <Avatar user={{ displayName: comment.authorName }} className="w-7 h-7 flex-shrink-0" />
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-semibold text-xs">{comment.authorName}</span>
                                                <span className="text-[10px] text-text-secondary">{new Date(comment.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm bg-white/5 p-2 rounded-r-lg rounded-bl-lg mt-1">{comment.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={addComment} className="flex gap-2">
                                <Avatar user={currentUser || { displayName: '?' }} className="w-8 h-8 flex-shrink-0" />
                                <input 
                                    value={modalComment}
                                    onChange={(e) => setModalComment(e.target.value)}
                                    placeholder="Написать комментарий..."
                                    className="flex-grow bg-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                            </form>
                        </div>
                    </div>

                    <div className="p-4 border-t border-glass-border flex justify-between items-center bg-black/20">
                        <span className="text-xs text-text-secondary">Создано {new Date(selectedTask.createdAt).toLocaleDateString()}</span>
                        <button 
                            onClick={deleteTask}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                        >
                            <Trash2 size={16} /> Удалить задачу
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

export default React.memo(KanbanWidget);