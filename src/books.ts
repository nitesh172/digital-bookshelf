export interface Chapter {
    title: string;
    content: string[];
}

export interface Book {
    id: string;
    title: string;
    author: string;
    color: string;
    spineColor: string;
    textColor: string;
    coverUrl?: string;
    chapters: Chapter[];
    isPersonal?: boolean;
    textUrl?: string;
    mobiUrl?: string;
    summary?: string;
}
