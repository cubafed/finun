import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {id:text('id').primaryKey(),kind:text('kind').notNull(),owner:text('owner').notNull(),parent:text('parent').notNull().default(''),data:text('data').notNull(),created:text('created').notNull()}, t=>[index('records_kind_parent').on(t.kind,t.parent)]);
export const settings = sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
