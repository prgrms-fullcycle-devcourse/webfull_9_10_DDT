import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: 'http://ddt-test.ddns.net:8080/api/docs-json', 
    
    output: {
      mode: 'tags-split', 
      target: 'src/api/generated/api.ts', 
      schemas: 'src/api/generated/models', 
      client: 'axios', 
      // override: {
      //   mutator: {
      //     path: 'src/api/custom-axios.ts',
      //     name: 'customAxios',
      //   },
      // },
    },
  },
});
