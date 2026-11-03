/* 访问口令配置
 *
 * ACCESS_PASSWORD 就是进入工作台的密码——改这一行 = 换密码（重新部署后生效）。
 * 验证原理：口令做 SHA-256 后与 ACCESS_HASH 比对；口令本身不进前端代码。
 * ACCESS_HASH 需与 ACCESS_PASSWORD 对应，生成方式见下（部署时已算好）。
 *
 * 注意：前端口令门挡"打开页面的人"；配合仓库私有化挡住拿到源码的人。
 */

// 口令：部署时填入。示例格式（请修改）：
export const ACCESS_PASSWORD = "haier2026";
// 口令的 SHA-256（hex），部署脚本会自动计算填入：
export const ACCESS_HASH = "bcf9aa7ed252a1e304ebf97abe4ad1af47a6636c1cf1311d6f0585a6f7499d3e";
