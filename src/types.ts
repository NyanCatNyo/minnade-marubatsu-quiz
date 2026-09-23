export type Choice = 'o'|'x';
export type Phase = 'setup'|'open'|'closed'|'finished';
export interface QuizEvent {id:string;title:string;phase:Phase;current:number;created:number}
export interface Question {number:number;category:string;body:string}
export interface Group {id:string;name:string}
export interface State {event:QuizEvent;question:Question|null;group:Group|null;answer:Choice|null}
export interface HostState {event:QuizEvent;questions:Question[];groups:(Group & {choice:Choice|null})[];totals:{o:number;x:number;pending:number}}
