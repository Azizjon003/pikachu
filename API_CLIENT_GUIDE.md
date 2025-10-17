# Pikachu API Client - Qo'llanma

## Mundarija

- [Kirish](#kirish)
- [O'rnatish](#ornatish)
- [Tezkor Boshlash](#tezkor-boshlash)
- [Autentifikatsiya](#autentifikatsiya)
- [API Client Metodlari](#api-client-metodlari)
  - [Taqdimot Yaratish](#taqdimot-yaratish)
  - [Template Boshqaruvi](#template-boshqaruvi)
  - [Taqdimotlar Bilan Ishlash](#taqdimotlar-bilan-ishlash)
- [JavaScript/TypeScript Misollar](#javascripttypescript-misollar)
- [Python Misollar](#python-misollar)
- [Xatoliklarni Boshqarish](#xatoliklarni-boshqarish)
- [Best Practices](#best-practices)

---

## Kirish

Pikachu API Client - bu Pikachu API bilan ishlashni osonlashtiruvchi wrapper kutubxonasi. Bu qo'llanma sizga API client orqali barcha funksiyalardan qanday foydalanishni ko'rsatadi.

**Asosiy imkoniyatlar:**
- ✅ Oddiy va tushunarli interfeys
- ✅ Avtomatik xatoliklarni boshqarish
- ✅ TypeScript qo'llab-quvvatlashi
- ✅ Rate limiting bilan ishlash
- ✅ File upload/download qo'llab-quvvatlashi

---

## O'rnatish

### Node.js/JavaScript

```bash
npm install axios
# yoki
yarn add axios
```

### Python

```bash
pip install requests
```

---

## Tezkor Boshlash

### JavaScript/TypeScript

```javascript
const axios = require('axios');

// API client yaratish
const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here' // optional
  }
});

// Taqdimot yaratish
const response = await client.post('/slide/generate', {
  template: 'modern-template.pptx.sxema.json',
  language: 'Uzbek',
  page: 10,
  topic: 'Artificial Intelligence',
  author: 'John Doe'
});

console.log('Taqdimot yaratildi:', response.data.slideName);
```

### Python

```python
import requests

# Base URL
BASE_URL = 'http://localhost:3000/api'

# Headers
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here'  # optional
}

# Taqdimot yaratish
response = requests.post(
    f'{BASE_URL}/slide/generate',
    headers=headers,
    json={
        'template': 'modern-template.pptx.sxema.json',
        'language': 'Uzbek',
        'page': 10,
        'topic': 'Artificial Intelligence',
        'author': 'John Doe'
    }
)

print('Taqdimot yaratildi:', response.json()['slideName'])
```

---

## Autentifikatsiya

Agar server `.env` faylida `API_KEY` sozlagan bo'lsa, barcha so'rovlar uchun API key talab qilinadi.

### JavaScript

```javascript
const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'X-API-Key': process.env.API_KEY // .env fayldan olish
  }
});
```

### Python

```python
import os

headers = {
    'X-API-Key': os.getenv('API_KEY')  # environment variable dan olish
}
```

---

## API Client Metodlari

### Taqdimot Yaratish

AI yordamida PowerPoint taqdimot yaratish.

#### JavaScript

```javascript
async function generatePresentation() {
  try {
    const response = await client.post('/slide/generate', {
      template: 'modern-template.pptx.sxema.json',
      language: 'Uzbek',
      page: 15,
      topic: 'Sun\'iy Intellekt va Kelajak',
      author: 'Akmal Abdullayev'
    });

    console.log('✅ Muvaffaqiyat!');
    console.log('Fayl nomi:', response.data.slideName);
    console.log('Fayl yo\'li:', response.data.slidePath);
    console.log('Validatsiya:', response.data.validation);

    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('❌ Rate limit oshib ketdi!');
    } else {
      console.error('❌ Xatolik:', error.response?.data?.error?.message);
    }
    throw error;
  }
}

// Ishlatish
generatePresentation().then(result => {
  console.log('Natija:', result);
});
```

#### Python

```python
def generate_presentation():
    """Taqdimot yaratish"""
    try:
        response = requests.post(
            f'{BASE_URL}/slide/generate',
            headers=headers,
            json={
                'template': 'modern-template.pptx.sxema.json',
                'language': 'Uzbek',
                'page': 15,
                'topic': 'Sun\'iy Intellekt va Kelajak',
                'author': 'Akmal Abdullayev'
            }
        )
        response.raise_for_status()

        data = response.json()
        print('✅ Muvaffaqiyat!')
        print(f'Fayl nomi: {data["slideName"]}')
        print(f'Fayl yo\'li: {data["slidePath"]}')

        return data
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            print('❌ Rate limit oshib ketdi!')
        else:
            print(f'❌ Xatolik: {e.response.json()["error"]["message"]}')
        raise

# Ishlatish
result = generate_presentation()
```

---

### Template Boshqaruvi

#### Barcha Templatelarni Olish

**JavaScript:**

```javascript
async function getTemplates() {
  try {
    const response = await client.get('/template/templates');
    const templates = response.data.templates;

    console.log(`Jami ${templates.length} ta template topildi:`);

    templates.forEach(template => {
      console.log(`\n📄 ${template.templateName}`);
      console.log(`   Preview: ${template.previewImage || 'Yo\'q'}`);
      console.log(`   Rasmlar: ${template.imageCount} ta`);
    });

    return templates;
  } catch (error) {
    console.error('Templatelarni yuklab bo\'lmadi:', error.message);
    throw error;
  }
}

// Ishlatish
getTemplates();
```

**Python:**

```python
def get_templates():
    """Barcha templatelarni olish"""
    try:
        response = requests.get(f'{BASE_URL}/template/templates', headers=headers)
        response.raise_for_status()

        templates = response.json()['templates']
        print(f'Jami {len(templates)} ta template topildi:')

        for template in templates:
            print(f'\n📄 {template["templateName"]}')
            print(f'   Preview: {template.get("previewImage", "Yo\'q")}')
            print(f'   Rasmlar: {template["imageCount"]} ta')

        return templates
    except requests.exceptions.RequestException as e:
        print(f'Templatelarni yuklab bo\'lmadi: {e}')
        raise

# Ishlatish
templates = get_templates()
```

#### Template Yuklash

**JavaScript:**

```javascript
const FormData = require('form-data');
const fs = require('fs');

async function uploadTemplate(filePath) {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const response = await client.post('/template/import', formData, {
      headers: formData.getHeaders()
    });

    console.log('✅ Template yuklandi!');
    console.log('Template path:', response.data.templatePath);
    console.log('Schema path:', response.data.schemaPath);

    return response.data;
  } catch (error) {
    console.error('❌ Template yuklanmadi:', error.response?.data?.error?.message);
    throw error;
  }
}

// Ishlatish
uploadTemplate('./my-template.pptx');
```

**Python:**

```python
def upload_template(file_path):
    """Template yuklash"""
    try:
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f'{BASE_URL}/template/import',
                headers={'X-API-Key': headers.get('X-API-Key')},
                files=files
            )
            response.raise_for_status()

        data = response.json()
        print('✅ Template yuklandi!')
        print(f'Template path: {data["templatePath"]}')
        print(f'Schema path: {data["schemaPath"]}')

        return data
    except Exception as e:
        print(f'❌ Template yuklanmadi: {e}')
        raise

# Ishlatish
upload_template('./my-template.pptx')
```

#### Template Preview Yuklash

**JavaScript:**

```javascript
async function uploadTemplatePreview(templateName, imageFilePath) {
  try {
    const formData = new FormData();
    formData.append('preview', fs.createReadStream(imageFilePath));

    const response = await client.post(
      `/template/${encodeURIComponent(templateName)}/preview`,
      formData,
      { headers: formData.getHeaders() }
    );

    console.log('✅ Preview yuklandi!');
    console.log('Preview URL:', response.data.previewUrl);

    return response.data;
  } catch (error) {
    console.error('❌ Preview yuklanmadi:', error.response?.data?.error?.message);
    throw error;
  }
}

// Ishlatish
uploadTemplatePreview('modern-template.pptx', './preview.jpg');
```

**Python:**

```python
def upload_template_preview(template_name, image_path):
    """Template preview yuklash"""
    try:
        with open(image_path, 'rb') as f:
            files = {'preview': f}
            response = requests.post(
                f'{BASE_URL}/template/{template_name}/preview',
                headers={'X-API-Key': headers.get('X-API-Key')},
                files=files
            )
            response.raise_for_status()

        data = response.json()
        print('✅ Preview yuklandi!')
        print(f'Preview URL: {data["previewUrl"]}')

        return data
    except Exception as e:
        print(f'❌ Preview yuklanmadi: {e}')
        raise

# Ishlatish
upload_template_preview('modern-template.pptx', './preview.jpg')
```

#### Template Preview Olish

**JavaScript:**

```javascript
async function getTemplatePreview(templateName, savePath) {
  try {
    const response = await client.get(
      `/template/${encodeURIComponent(templateName)}/preview`,
      { responseType: 'arraybuffer' }
    );

    fs.writeFileSync(savePath, response.data);
    console.log(`✅ Preview saqlandi: ${savePath}`);

    return savePath;
  } catch (error) {
    if (error.response?.status === 404) {
      console.error('❌ Preview topilmadi');
    } else {
      console.error('❌ Xatolik:', error.message);
    }
    throw error;
  }
}

// Ishlatish
getTemplatePreview('modern-template.pptx', './downloaded-preview.jpg');
```

**Python:**

```python
def get_template_preview(template_name, save_path):
    """Template preview olish"""
    try:
        response = requests.get(
            f'{BASE_URL}/template/{template_name}/preview',
            headers={'X-API-Key': headers.get('X-API-Key')}
        )
        response.raise_for_status()

        with open(save_path, 'wb') as f:
            f.write(response.content)

        print(f'✅ Preview saqlandi: {save_path}')
        return save_path
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print('❌ Preview topilmadi')
        else:
            print(f'❌ Xatolik: {e}')
        raise

# Ishlatish
get_template_preview('modern-template.pptx', './downloaded-preview.jpg')
```

---

### Taqdimotlar Bilan Ishlash

#### Barcha Taqdimotlarni Ko'rish

**JavaScript:**

```javascript
async function listPresentations() {
  try {
    const response = await client.get('/presentations/list');
    const presentations = response.data.presentations;

    console.log(`Jami ${presentations.length} ta taqdimot:`);

    presentations.forEach(pres => {
      const sizeMB = (pres.size / 1024 / 1024).toFixed(2);
      console.log(`\n📊 ${pres.filename}`);
      console.log(`   Hajmi: ${sizeMB} MB`);
      console.log(`   Yaratilgan: ${new Date(pres.createdAt).toLocaleString()}`);
    });

    return presentations;
  } catch (error) {
    console.error('Taqdimotlarni yuklab bo\'lmadi:', error.message);
    throw error;
  }
}

// Ishlatish
listPresentations();
```

**Python:**

```python
def list_presentations():
    """Barcha taqdimotlarni ko'rish"""
    try:
        response = requests.get(f'{BASE_URL}/presentations/list', headers=headers)
        response.raise_for_status()

        presentations = response.json()['presentations']
        print(f'Jami {len(presentations)} ta taqdimot:')

        for pres in presentations:
            size_mb = pres['size'] / 1024 / 1024
            print(f'\n📊 {pres["filename"]}')
            print(f'   Hajmi: {size_mb:.2f} MB')
            print(f'   Yaratilgan: {pres["createdAt"]}')

        return presentations
    except Exception as e:
        print(f'Taqdimotlarni yuklab bo\'lmadi: {e}')
        raise

# Ishlatish
presentations = list_presentations()
```

#### Taqdimotni Yuklab Olish

**JavaScript:**

```javascript
async function downloadPresentation(filename, savePath) {
  try {
    const response = await client.get(
      `/presentations/download/${encodeURIComponent(filename)}`,
      { responseType: 'arraybuffer' }
    );

    fs.writeFileSync(savePath, response.data);
    console.log(`✅ Taqdimot saqlandi: ${savePath}`);

    return savePath;
  } catch (error) {
    console.error('❌ Yuklab bo\'lmadi:', error.message);
    throw error;
  }
}

// Ishlatish
downloadPresentation('1234567890-Artificial-Intelligence.pptx', './presentation.pptx');
```

**Python:**

```python
def download_presentation(filename, save_path):
    """Taqdimotni yuklab olish"""
    try:
        response = requests.get(
            f'{BASE_URL}/presentations/download/{filename}',
            headers=headers
        )
        response.raise_for_status()

        with open(save_path, 'wb') as f:
            f.write(response.content)

        print(f'✅ Taqdimot saqlandi: {save_path}')
        return save_path
    except Exception as e:
        print(f'❌ Yuklab bo\'lmadi: {e}')
        raise

# Ishlatish
download_presentation('1234567890-Artificial-Intelligence.pptx', './presentation.pptx')
```

#### Taqdimotni O'chirish

**JavaScript:**

```javascript
async function deletePresentation(filename) {
  try {
    const response = await client.delete(
      `/presentations/${encodeURIComponent(filename)}`
    );

    console.log('✅ O\'chirildi!');
    console.log('O\'chirilgan fayllar:', response.data.deletedFiles);

    return response.data;
  } catch (error) {
    console.error('❌ O\'chirib bo\'lmadi:', error.message);
    throw error;
  }
}

// Ishlatish
deletePresentation('1234567890-Artificial-Intelligence.pptx');
```

**Python:**

```python
def delete_presentation(filename):
    """Taqdimotni o'chirish"""
    try:
        response = requests.delete(
            f'{BASE_URL}/presentations/{filename}',
            headers=headers
        )
        response.raise_for_status()

        data = response.json()
        print('✅ O\'chirildi!')
        print(f'O\'chirilgan fayllar: {data["deletedFiles"]}')

        return data
    except Exception as e:
        print(f'❌ O\'chirib bo\'lmadi: {e}')
        raise

# Ishlatish
delete_presentation('1234567890-Artificial-Intelligence.pptx')
```

#### Statistikani Olish

**JavaScript:**

```javascript
async function getStatistics() {
  try {
    const response = await client.get('/presentations/stats');
    const stats = response.data.stats;

    console.log('📈 Statistika:');
    console.log(`   Jami taqdimotlar: ${stats.totalPresentations}`);
    console.log(`   Umumiy hajm: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   O'rtacha hajm: ${(stats.averageSize / 1024 / 1024).toFixed(2)} MB`);

    return stats;
  } catch (error) {
    console.error('Statistika olinmadi:', error.message);
    throw error;
  }
}

// Ishlatish
getStatistics();
```

**Python:**

```python
def get_statistics():
    """Statistikani olish"""
    try:
        response = requests.get(f'{BASE_URL}/presentations/stats', headers=headers)
        response.raise_for_status()

        stats = response.json()['stats']
        total_mb = stats['totalSize'] / 1024 / 1024
        avg_mb = stats['averageSize'] / 1024 / 1024

        print('📈 Statistika:')
        print(f'   Jami taqdimotlar: {stats["totalPresentations"]}')
        print(f'   Umumiy hajm: {total_mb:.2f} MB')
        print(f'   O\'rtacha hajm: {avg_mb:.2f} MB')

        return stats
    except Exception as e:
        print(f'Statistika olinmadi: {e}')
        raise

# Ishlatish
stats = get_statistics()
```

---

## JavaScript/TypeScript Misollar

### To'liq TypeScript Class

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import fs from 'fs';

interface GenerateOptions {
  template: string;
  language: string;
  page: number;
  topic: string;
  author?: string;
}

interface Template {
  name: string;
  templateName: string;
  previewImage?: string;
  images: any[];
  imageCount: number;
}

interface Presentation {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  jsonFile: string;
}

class PikachuAPIClient {
  private client: AxiosInstance;

  constructor(baseURL: string = 'http://localhost:3000/api', apiKey?: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-Key': apiKey })
      }
    });
  }

  /**
   * Taqdimot yaratish
   */
  async generatePresentation(options: GenerateOptions) {
    try {
      const response = await this.client.post('/slide/generate', options);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Barcha templatelarni olish
   */
  async getTemplates(): Promise<Template[]> {
    try {
      const response = await this.client.get('/template/templates');
      return response.data.templates;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Template yuklash
   */
  async uploadTemplate(filePath: string) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const response = await this.client.post('/template/import', formData, {
        headers: formData.getHeaders()
      });
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Template preview yuklash
   */
  async uploadTemplatePreview(templateName: string, imageFilePath: string) {
    try {
      const formData = new FormData();
      formData.append('preview', fs.createReadStream(imageFilePath));

      const response = await this.client.post(
        `/template/${encodeURIComponent(templateName)}/preview`,
        formData,
        { headers: formData.getHeaders() }
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Barcha taqdimotlarni olish
   */
  async listPresentations(): Promise<Presentation[]> {
    try {
      const response = await this.client.get('/presentations/list');
      return response.data.presentations;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Taqdimotni yuklab olish
   */
  async downloadPresentation(filename: string, savePath: string) {
    try {
      const response = await this.client.get(
        `/presentations/download/${encodeURIComponent(filename)}`,
        { responseType: 'arraybuffer' }
      );

      fs.writeFileSync(savePath, response.data);
      return savePath;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Taqdimotni o'chirish
   */
  async deletePresentation(filename: string) {
    try {
      const response = await this.client.delete(
        `/presentations/${encodeURIComponent(filename)}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Statistikani olish
   */
  async getStatistics() {
    try {
      const response = await this.client.get('/presentations/stats');
      return response.data.stats;
    } catch (error) {
      this.handleError(error as AxiosError);
    }
  }

  /**
   * Xatoliklarni boshqarish
   */
  private handleError(error: AxiosError): never {
    if (error.response) {
      const status = error.response.status;
      const data: any = error.response.data;

      if (status === 429) {
        throw new Error('Rate limit oshib ketdi. Biroz kuting.');
      } else if (status === 401) {
        throw new Error('API key talab qilinadi.');
      } else if (status === 403) {
        throw new Error('API key noto\'g\'ri.');
      } else if (data?.error?.message) {
        throw new Error(data.error.message);
      }
    }

    throw new Error(error.message || 'Noma\'lum xatolik');
  }
}

// Ishlatish
const client = new PikachuAPIClient('http://localhost:3000/api', 'your_api_key');

async function main() {
  // Taqdimot yaratish
  const result = await client.generatePresentation({
    template: 'modern-template.pptx.sxema.json',
    language: 'Uzbek',
    page: 10,
    topic: 'Artificial Intelligence',
    author: 'John Doe'
  });

  console.log('Taqdimot yaratildi:', result.slideName);

  // Taqdimotni yuklab olish
  await client.downloadPresentation(result.slideName, './my-presentation.pptx');
}

main().catch(console.error);
```

---

## Python Misollar

### To'liq Python Class

```python
import requests
from typing import Dict, List, Any, Optional
import os

class PikachuAPIClient:
    """Pikachu API Client"""

    def __init__(self, base_url: str = 'http://localhost:3000/api', api_key: Optional[str] = None):
        self.base_url = base_url
        self.headers = {'Content-Type': 'application/json'}

        if api_key:
            self.headers['X-API-Key'] = api_key

    def generate_presentation(self, template: str, language: str, page: int,
                            topic: str, author: Optional[str] = None) -> Dict[str, Any]:
        """Taqdimot yaratish"""
        data = {
            'template': template,
            'language': language,
            'page': page,
            'topic': topic
        }
        if author:
            data['author'] = author

        response = self._post('/slide/generate', json=data)
        return response

    def get_templates(self) -> List[Dict[str, Any]]:
        """Barcha templatelarni olish"""
        response = self._get('/template/templates')
        return response['templates']

    def upload_template(self, file_path: str) -> Dict[str, Any]:
        """Template yuklash"""
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f'{self.base_url}/template/import',
                headers={'X-API-Key': self.headers.get('X-API-Key', '')},
                files=files
            )
            response.raise_for_status()
            return response.json()

    def upload_template_preview(self, template_name: str, image_path: str) -> Dict[str, Any]:
        """Template preview yuklash"""
        with open(image_path, 'rb') as f:
            files = {'preview': f}
            response = requests.post(
                f'{self.base_url}/template/{template_name}/preview',
                headers={'X-API-Key': self.headers.get('X-API-Key', '')},
                files=files
            )
            response.raise_for_status()
            return response.json()

    def list_presentations(self) -> List[Dict[str, Any]]:
        """Barcha taqdimotlarni ko'rish"""
        response = self._get('/presentations/list')
        return response['presentations']

    def download_presentation(self, filename: str, save_path: str) -> str:
        """Taqdimotni yuklab olish"""
        response = requests.get(
            f'{self.base_url}/presentations/download/{filename}',
            headers={'X-API-Key': self.headers.get('X-API-Key', '')}
        )
        response.raise_for_status()

        with open(save_path, 'wb') as f:
            f.write(response.content)

        return save_path

    def delete_presentation(self, filename: str) -> Dict[str, Any]:
        """Taqdimotni o'chirish"""
        response = self._delete(f'/presentations/{filename}')
        return response

    def get_statistics(self) -> Dict[str, Any]:
        """Statistikani olish"""
        response = self._get('/presentations/stats')
        return response['stats']

    def _get(self, endpoint: str) -> Dict[str, Any]:
        """GET so'rov yuborish"""
        try:
            response = requests.get(f'{self.base_url}{endpoint}', headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self._handle_error(e)

    def _post(self, endpoint: str, json: Dict[str, Any]) -> Dict[str, Any]:
        """POST so'rov yuborish"""
        try:
            response = requests.post(f'{self.base_url}{endpoint}', headers=self.headers, json=json)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self._handle_error(e)

    def _delete(self, endpoint: str) -> Dict[str, Any]:
        """DELETE so'rov yuborish"""
        try:
            response = requests.delete(f'{self.base_url}{endpoint}', headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self._handle_error(e)

    def _handle_error(self, error: requests.exceptions.RequestException):
        """Xatoliklarni boshqarish"""
        if hasattr(error, 'response') and error.response is not None:
            status = error.response.status_code

            if status == 429:
                raise Exception('Rate limit oshib ketdi. Biroz kuting.')
            elif status == 401:
                raise Exception('API key talab qilinadi.')
            elif status == 403:
                raise Exception('API key noto\'g\'ri.')

            try:
                data = error.response.json()
                if 'error' in data and 'message' in data['error']:
                    raise Exception(data['error']['message'])
            except:
                pass

        raise Exception(str(error))


# Ishlatish
if __name__ == '__main__':
    client = PikachuAPIClient(api_key='your_api_key')

    # Taqdimot yaratish
    result = client.generate_presentation(
        template='modern-template.pptx.sxema.json',
        language='Uzbek',
        page=10,
        topic='Artificial Intelligence',
        author='John Doe'
    )

    print(f'Taqdimot yaratildi: {result["slideName"]}')

    # Taqdimotni yuklab olish
    client.download_presentation(result['slideName'], './my-presentation.pptx')
    print('Taqdimot saqlandi!')
```

---

## Xatoliklarni Boshqarish

### Asosiy Xatoliklar

| Status Code | Xatolik | Yechim |
|-------------|---------|--------|
| 400 | Bad Request | So'rov parametrlarini tekshiring |
| 401 | Unauthorized | API key qo'shing |
| 403 | Forbidden | API key to'g'riligini tekshiring |
| 404 | Not Found | Fayl yoki endpoint mavjudligini tekshiring |
| 429 | Rate Limit | Biroz kuting va qayta urinib ko'ring |
| 500 | Server Error | Server loglarini tekshiring |

### Retry Logic (JavaScript)

```javascript
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        console.log(`Rate limit, kutilmoqda ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

// Ishlatish
await withRetry(() =>
  client.post('/slide/generate', options)
);
```

### Retry Logic (Python)

```python
import time

def with_retry(func, max_retries=3, delay=1):
    """Retry logic"""
    for i in range(max_retries):
        try:
            return func()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429 and i < max_retries - 1:
                print(f'Rate limit, kutilmoqda {delay}s...')
                time.sleep(delay)
                delay *= 2  # Exponential backoff
            else:
                raise

# Ishlatish
result = with_retry(lambda: client.generate_presentation(...))
```

---

## Best Practices

### 1. Environment Variables

**`.env` faylidan foydalaning:**

```bash
API_BASE_URL=http://localhost:3000/api
API_KEY=your_secret_api_key_here
```

**JavaScript:**
```javascript
require('dotenv').config();

const client = new PikachuAPIClient(
  process.env.API_BASE_URL,
  process.env.API_KEY
);
```

**Python:**
```python
from dotenv import load_dotenv
load_dotenv()

client = PikachuAPIClient(
    base_url=os.getenv('API_BASE_URL'),
    api_key=os.getenv('API_KEY')
)
```

### 2. Rate Limiting

Rate limitga yo'l qo'ymang:

```javascript
// ❌ Noto'g'ri
for (let i = 0; i < 20; i++) {
  await generatePresentation();
}

// ✅ To'g'ri
for (let i = 0; i < 20; i++) {
  await generatePresentation();
  await new Promise(r => setTimeout(r, 6000)); // 6 soniya kutish
}
```

### 3. Error Handling

Har doim try-catch ishlating:

```javascript
try {
  const result = await client.generatePresentation(options);
  console.log('Muvaffaqiyat:', result);
} catch (error) {
  console.error('Xatolik:', error.message);
  // Logga yozing, foydalanuvchiga xabar bering, va hokazo
}
```

### 4. Timeout

Timeout qo'ying:

```javascript
const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 300000 // 5 daqiqa (taqdimot yaratish uzoq davom etishi mumkin)
});
```

### 5. Progress Tracking

Katta fayllarni yuklashda progress ko'rsating:

```javascript
await client.post('/template/import', formData, {
  onUploadProgress: (progressEvent) => {
    const percentage = Math.round(
      (progressEvent.loaded * 100) / progressEvent.total
    );
    console.log(`Yuklash: ${percentage}%`);
  }
});
```

---

## Qo'shimcha Resurslar

- **API Dokumentatsiya:** `API_DOCUMENTATION.md`
- **Server kodi:** `src/services/api/`
- **GitHub:** [Repository Link]
- **Support:** support@example.com

---

## Changelog

### Version 1.0.0 (2024-01-17)
- ✨ Initial release
- 📚 To'liq API client qo'llanmasi
- 💡 JavaScript/TypeScript va Python misollar
- 🔧 Error handling va best practices

---

**Savol-javoblar uchun:** [GitHub Issues](https://github.com/your-repo/issues)
