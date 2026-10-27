/* Supabase 连接配置
 *
 * 部署前请把下面两个值替换为你自己 Supabase 项目的：
 *   Project URL   —— Dashboard → Project Settings → API → Project URL
 *   anon key      —— 同页 anon public 开头的密钥
 *
 * 该 anon key 本就是「前端公开密钥」，且本工作台定位为团队公开访问、
 * 数据全共享，允许放入前端代码。表级安全由 schema.sql 中的 RLS 策略控制。
 * 若不想改代码重新构建，也可以在页面首次打开时的「初始化配置」界面里
 * 粘贴这两项（仅保存在当前浏览器，逐人配置一次）。
 */
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
