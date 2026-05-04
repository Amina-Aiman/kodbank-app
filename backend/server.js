const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const app = require('./app');
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Kodbank API running on http://localhost:${PORT}`);
  const hasKey = !!(process.env.HUGGINGFACE_API_KEY || '').trim();
  console.log(`AI chat: using Hugging Face router API (router.huggingface.co). Token: ${hasKey ? 'configured' : 'NOT set - add HUGGINGFACE_API_KEY in backend/.env with "Make calls to Inference Providers" permission'}`);
});
