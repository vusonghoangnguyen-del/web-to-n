import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadEnv({ path: path.join(repoRoot, '.env'), quiet: true });
for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
  if (!process.env[key]) throw new Error(`Thiếu ${key} trong .env. Hãy chạy db:setup và migration:run trước.`);
}

const samples = [
  {
    slug: 'mau-dinh-ly-pythagore', title: 'Định lý Pythagore qua diện tích', difficulty: 'Dễ', categories: ['hinh-hoc'],
    body: 'Cho tam giác vuông có hai cạnh góc vuông $a,b$ và cạnh huyền $c$. Ta có\n\n$$a^2+b^2=c^2.$$\n\nMột cách nhìn trực quan: xếp bốn tam giác vuông bằng nhau vào hình vuông cạnh $a+b$. Phần còn lại ở giữa là hình vuông cạnh $c$. So sánh hai cách tính diện tích:\n\n$$(a+b)^2=4\\cdot\\frac{ab}{2}+c^2.$$\n\nRút gọn hai vế thu được kết quả. Bạn có thể thử vẽ hình với $a=3$, $b=4$ và kiểm tra $c=5$.',
  },
  {
    slug: 'mau-tong-so-le', title: 'Vì sao tổng các số lẻ đầu tiên là một số chính phương?', difficulty: 'Dễ', categories: ['so-hoc', 'dai-so'],
    body: 'Quan sát dãy $1, 1+3, 1+3+5, \\ldots$. Các tổng lần lượt là $1,4,9,\\ldots$. Công thức tổng quát:\n\n$$1+3+5+\\cdots+(2n-1)=n^2.$$\n\nCó thể chứng minh bằng quy nạp. Với $n=1$, mệnh đề đúng. Nếu tổng $n$ số lẻ đầu là $n^2$, cộng số lẻ tiếp theo $2n+1$ ta được $n^2+2n+1=(n+1)^2$.\n\nMột cách khác là ghép từng lớp hình chữ L gồm $2n-1$ ô để mở rộng hình vuông cạnh $n-1$ thành hình vuông cạnh $n$.',
  },
  {
    slug: 'mau-phuong-trinh-bac-hai', title: 'Giải phương trình bậc hai bằng cách hoàn thành bình phương', difficulty: 'Trung bình', categories: ['dai-so'],
    body: 'Xét phương trình $ax^2+bx+c=0$ với $a\\ne0$. Chia hai vế cho $a$, rồi chuyển hằng số sang phải:\n\n$$x^2+\\frac{b}{a}x=-\\frac{c}{a}.$$\n\nCộng $\\left(\\frac{b}{2a}\\right)^2$ vào hai vế:\n\n$$\\left(x+\\frac{b}{2a}\\right)^2=\\frac{b^2-4ac}{4a^2}.$$\n\nĐặt $\\Delta=b^2-4ac$. Khi $\\Delta\\ge0$, ta thu được công thức nghiệm $x=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}$. Hãy thử áp dụng cho $2x^2+3x-5=0$.',
  },
  {
    slug: 'mau-xac-suat-hai-xuc-xac', title: 'Xác suất khi gieo hai xúc xắc', difficulty: 'Trung bình', categories: ['xac-suat', 'to-hop'],
    body: 'Gieo đồng thời hai xúc xắc cân đối. Không gian mẫu gồm $6\\times6=36$ kết quả có thứ tự và đồng khả năng.\n\nMuốn tổng hai mặt bằng $7$, có sáu cặp: $(1,6),(2,5),(3,4),(4,3),(5,2),(6,1)$. Do đó\n\n$$P(\\text{tổng bằng }7)=\\frac{6}{36}=\\frac16.$$\n\nNếu chỉ hỏi “hai mặt giống nhau”, cũng có sáu kết quả thuận lợi nên xác suất bằng $\\frac16$. Hai biến cố này khác nhau dù có cùng xác suất.',
  },
];

const db = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
try {
  await db.beginTransaction();
  const [existingAuthor] = await db.execute('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1', ['to_toan_mau', 'demo@to-toan.invalid']);
  let authorId = existingAuthor[0]?.id;
  if (!authorId) {
    const randomPassword = crypto.randomBytes(48).toString('base64url');
    const hash = await bcrypt.hash(randomPassword, 12);
    const [result] = await db.execute(
      "INSERT INTO users (username, name, email, password_hash, role, status, email_verified_at) VALUES (?, ?, ?, ?, 'reader', 'active', CURRENT_TIMESTAMP)",
      ['to_toan_mau', 'Tờ Toán · Bài mẫu', 'demo@to-toan.invalid', hash],
    );
    authorId = result.insertId;
  }

  let created = 0;
  for (const sample of samples) {
    const [existing] = await db.execute('SELECT id FROM problems WHERE slug = ? LIMIT 1', [sample.slug]);
    if (existing.length) continue;
    const [result] = await db.execute(
      "INSERT INTO problems (author_id, slug, title, content, difficulty, status, published_at) VALUES (?, ?, ?, ?, ?, 'published', CURRENT_TIMESTAMP)",
      [authorId, sample.slug, sample.title, sample.body, sample.difficulty],
    );
    for (const slug of sample.categories) {
      const [categories] = await db.execute('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
      if (!categories.length) throw new Error(`Thiếu chuyên mục ${slug}. Hãy chạy migration:run trước.`);
      await db.execute('INSERT INTO problem_categories (problem_id, category_id) VALUES (?, ?)', [result.insertId, categories[0].id]);
    }
    await db.execute(
      "INSERT INTO problem_revisions (problem_id, editor_id, version, title, content, difficulty, status, category_slugs, change_summary) VALUES (?, ?, 1, ?, ?, ?, 'published', ?, ?)",
      [result.insertId, authorId, sample.title, sample.body, sample.difficulty, JSON.stringify(sample.categories), 'Dữ liệu mẫu'],
    );
    created += 1;
  }
  await db.commit();
  console.log(`Đã thêm ${created} bài mẫu; ${samples.length - created} bài đã tồn tại. Không sửa bài hoặc tài khoản thật.`);
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
