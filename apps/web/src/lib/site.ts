// No DOM here: apps/web/server/head.ts renders the same titles into the HTML.

export const SITE_NAME = "Eventide";
export const SITE_DESCRIPTION = "ค้นหาอีเวนต์ที่น่าสนใจ ลงทะเบียน และรับตั๋วได้ในที่เดียว";

/** "<title> | Eventide", or just "Eventide" */
export const pageTitle = (title?: string) => (title ? `${title} | ${SITE_NAME}` : SITE_NAME);
