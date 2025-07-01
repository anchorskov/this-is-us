# ./index_project.py

import os
from pathlib import Path
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, StorageContext, load_index_from_storage
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama

# Setup Ollama LLM and Embedding
llm = Ollama(model="mistral")
embed_model = OllamaEmbedding(model_name="nomic-embed-text")  # optionally: "all-minilm"

# Path setup
DATA_DIR = Path("./docs")
INDEX_DIR = Path("./storage")
INDEX_DIR.mkdir(exist_ok=True)

def load_docs(limit=None):
    docs = SimpleDirectoryReader(str(DATA_DIR)).load_data()
    if limit:
        docs = docs[:limit]
    print(f"📄 Loaded {len(docs)} documents.")
    return docs

def create_or_load_index(documents):
    if INDEX_DIR.exists() and any(INDEX_DIR.iterdir()):
        print("✅ Loading existing index...")
        return load_index_from_storage(StorageContext.from_defaults(persist_dir=str(INDEX_DIR)))

    print("⚙️ Creating new index...")
    for doc in documents:
        print(f"🔍 Embedding: {doc.metadata.get('file_path', 'unknown')}")
    index = VectorStoreIndex.from_documents(documents, embed_model=embed_model)
    index.storage_context.persist(persist_dir=str(INDEX_DIR))
    print("✅ Indexing complete.")
    return index

if __name__ == "__main__":
    docs = load_docs(limit=None)  # or limit=2 for testing
    index = create_or_load_index(docs)
