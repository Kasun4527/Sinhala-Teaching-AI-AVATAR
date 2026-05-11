import os
import numpy as np
import textwrap
from dotenv import load_dotenv
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.cluster import KMeans, DBSCAN
from sklearn.neighbors import NearestNeighbors
import umap
import plotly.express as px

from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

load_dotenv()

def load_faiss_store(persist_directory):
    emb_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    db = FAISS.load_local(persist_directory, emb_model, allow_dangerous_deserialization=True)
    return db, emb_model

def extract_vectors_texts_meta(db, emb_model):
    docstore = getattr(db, "docstore", None)
    idx_to_id = getattr(db, "index_to_docstore_id", None)
    faiss_index = getattr(db, "index", None) or getattr(db, "_faiss_index", None) or getattr(db, "faiss_index", None)

    texts, metas, vectors = [], [], []

    if faiss_index is not None and idx_to_id is not None and docstore is not None:
        # Best-effort: iterate index_to_docstore_id mapping
        items = list(idx_to_id.items())
        try:
            items = sorted(items, key=lambda x: int(x[0]))
        except Exception:
            items = sorted(items, key=lambda x: x[0])
        for idx_key, doc_id in items:
            try:
                idx = int(idx_key)
            except Exception:
                idx = idx_key
            # reconstruct vector if available
            try:
                vec = faiss_index.reconstruct(idx)
            except Exception:
                try:
                    vec = faiss_index.index.reconstruct(idx)
                except Exception:
                    vec = None
            if vec is not None:
                vectors.append(np.array(vec))
            # docstore may hold Document objects or dicts
            doc = None
            if hasattr(docstore, "_dict"):
                doc = docstore._dict.get(str(doc_id)) or docstore._dict.get(doc_id)
            if doc:
                content = getattr(doc, "page_content", None) or doc.get("page_content", "")
                meta = getattr(doc, "metadata", None) or doc.get("metadata", {})
            else:
                content = ""
                meta = {}
            texts.append(content)
            metas.append(meta)
        vectors = np.vstack(vectors) if vectors else np.array([])
    else:
        # fallback: compute embeddings from stored docs (slower)
        print("FAISS internals not accessible — computing embeddings from doc texts.")
        docs = getattr(docstore, "_dict", {}) if docstore else {}
        for k, doc in docs.items():
            content = getattr(doc, "page_content", None) or doc.get("page_content", "")
            meta = getattr(doc, "metadata", None) or doc.get("metadata", {})
            texts.append(content)
            metas.append(meta)
        if texts:
            vectors = np.array(emb_model.embed_documents(texts))
    return vectors, texts, metas

def summarize_meta_field(metas, field_candidates=("topic","source","filename","file","source_file","page")):
    # returns a list of labels derived from metadata; fallbacks to index
    labels = []
    for m in metas:
        label = None
        for f in field_candidates:
            if isinstance(m, dict) and f in m and m[f]:
                label = m[f]
                break
        # if source is a path, take basename
        if label and isinstance(label, str) and os.path.sep in label:
            label = os.path.basename(label)
        labels.append(label or "")
    return labels

def plot_static_2d(points, outpath, title="Projection", cmap="viridis"):
    plt.figure(figsize=(10,8))
    sc = plt.scatter(points[:,0], points[:,1], c=range(len(points)), cmap=cmap, s=60, alpha=0.75)
    plt.colorbar(sc, label="Document index")
    plt.title(title)
    plt.xlabel("Dim 1")
    plt.ylabel("Dim 2")
    plt.tight_layout()
    plt.savefig(outpath, dpi=200)
    plt.close()
    print(f"Saved {outpath}")

def interactive_umap(vectors, metas, labels_for_color, out_html="vector_umap.html"):
    reducer = umap.UMAP(n_components=2, random_state=42)
    proj = reducer.fit_transform(vectors)
    df_hover = []
    for i, m in enumerate(metas):
        text = (m.get("page_content") if isinstance(m, dict) else "") or ""
        snippet = (text[:300] + "...") if text else ""
        source = m.get("source") or m.get("filename") or m.get("file") or ""
        page = m.get("page") or m.get("page_number") or ""
        df_hover.append({"index": i, "snippet": snippet, "source": source, "page": page, "meta": m})
    hover_texts = [f"{d['source']} | page:{d['page']}<br>{d['snippet']}" for d in df_hover]
    fig = px.scatter(x=proj[:,0], y=proj[:,1], color=labels_for_color,
                     hover_name=[f"doc {i}" for i in range(len(proj))],
                     hover_data={"hover": hover_texts},
                     labels={"color":"Label"})
    fig.update_traces(marker=dict(size=8, opacity=0.8))
    fig.update_layout(title="Interactive UMAP projection")
    fig.write_html(out_html)
    print(f"Wrote interactive UMAP to {out_html}")

def cluster_and_inspect(vectors, texts, metas, method="kmeans", k=6):
    if method == "kmeans":
        model = KMeans(n_clusters=k, random_state=42)
        labels = model.fit_predict(vectors)
    else:
        model = DBSCAN(eps=0.6, min_samples=5)
        labels = model.fit_predict(vectors)

    # representative samples per cluster
    clusters = {}
    nbrs = NearestNeighbors(n_neighbors=min(10, len(vectors))).fit(vectors)
    for cluster_label in sorted(set(labels)):
        idxs = np.where(labels == cluster_label)[0].tolist()
        if not idxs:
            continue
        # cluster centroid
        centroid = vectors[idxs].mean(axis=0)
        # find nearest to centroid
        distances = np.linalg.norm(vectors[idxs] - centroid, axis=1)
        order = np.argsort(distances)[:5]
        rep_idxs = [idxs[i] for i in order]
        clusters[cluster_label] = {"count": len(idxs), "representatives": rep_idxs}
    # print summary
    for cl, info in clusters.items():
        print(f"\n--- Cluster {cl} (n={info['count']}) ---")
        for ridx in info["representatives"]:
            snippet = texts[ridx][:400].replace("\n", " ")
            source = metas[ridx].get("source") or metas[ridx].get("filename") or ""
            print(f"[{ridx}] source={source} | {textwrap.shorten(snippet, width=200)}")
    return labels

def nearest_neighbors_check(vectors, texts, metas, sample_idxs=None, k=5):
    if sample_idxs is None:
        sample_idxs = list(range(0, min(3, len(vectors))))
    nn = NearestNeighbors(n_neighbors=min(k+1, len(vectors))).fit(vectors)
    for s in sample_idxs:
        if s >= len(vectors): continue
        dists, idxs = nn.kneighbors([vectors[s]])
        idxs = idxs[0].tolist()
        dists = dists[0].tolist()
        print(f"\nNeighbors for sample {s} (source={metas[s].get('source') or ''}):")
        for rank, (i, dist) in enumerate(zip(idxs, dists)):
            if i == s:
                continue
            snippet = texts[i][:300].replace("\n", " ")
            print(f"  {rank}. idx={i} dist={dist:.4f} src={metas[i].get('source') or ''} -> {textwrap.shorten(snippet, width=180)}")
        if len(idxs) <= 1:
            print("  (no neighbors)")

if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)
    persist_dir = os.path.join(base_dir, "vector_store")  # matches retriever.py
    print("Loading FAISS store:", persist_dir)
    db, emb = load_faiss_store(persist_dir)

    vectors, texts, metas = extract_vectors_texts_meta(db, emb)
    if vectors is None or len(vectors) == 0:
        print("No vectors found; aborting.")
        raise SystemExit(1)

    print(f"Loaded {len(vectors)} vectors (dim={vectors.shape[1]})")

    # prepare labels from metadata (topic / filename / page)
    labels_meta = summarize_meta_field(metas, field_candidates=("topic","source","filename","file"))
    labels_for_color = labels_meta if any(labels_meta) else [str(i) for i in range(len(vectors))]

    # PCA (static)
    pca = PCA(n_components=2)
    pca_pts = pca.fit_transform(vectors)
    plot_static_2d(pca_pts, outpath="vector_store_pca.png", title=f"PCA ({pca.explained_variance_ratio_.sum():.2f} variance)")

    # t-SNE (static) - adjust perplexity
    perp = min(30, max(5, len(vectors)//10))
    tsne = TSNE(n_components=2, perplexity=max(5,min(perp, len(vectors)-1)), random_state=42)
    tsne_pts = tsne.fit_transform(vectors)
    plot_static_2d(tsne_pts, outpath="vector_store_tsne.png", title="t-SNE projection")

    # UMAP interactive
    interactive_umap(vectors, metas, labels_for_color, out_html="vector_store_umap.html")

    # clustering and inspection
    labels_k = cluster_and_inspect(vectors, texts, metas, method="kmeans", k=6)
    labels_db = cluster_and_inspect(vectors, texts, metas, method="dbscan")

    # nearest neighbors sampling
    nearest_neighbors_check(vectors, texts, metas, sample_idxs=[0, max(1, len(vectors)//3), max(2, len(vectors)-1)], k=5)

    print("\nDone. Outputs: vector_store_pca.png, vector_store_tsne.png, vector_store_umap.html")