# How do large language models work?

## Abstract
Large language models (LLMs) operate by learning statistical patterns of language from massive text corpora and using those patterns to predict and generate text one token at a time, typically via self-supervised pretraining [1]. Modern LLMs use transformer architectures with word or token embeddings and self-attention, which allow them to represent context and prioritize relevant input when producing outputs [1,5]. A notable emergent capability of pretrained transformers is in-context learning (ICL), where the model generalizes to new tasks from a few examples provided in the prompt, and this ability depends strongly on model scale and pretraining task diversity [5,9]. Empirical measurements report that increasing pretraining task diversity can boost representation accuracy by about 2–3%, improve linear-probe accuracy by ~1.12%, and increase attention-head diversity by about 4% [9].

## Introduction
This report synthesizes dossier findings on how large language models work, focusing on core algorithms, transformer mechanisms that enable in-context learning, and the representational changes that accompany shifts in pretraining task diversity. The dossier frames LLMs primarily as next-token prediction systems trained with self-supervised objectives and implemented with transformer architectures and embeddings [1]. Subsequent layers of research investigate when and how transformer models develop in-context learning that generalizes out of distribution, and how scale and task diversity shape that emergence [5,9]. The report uses experimental results and statistics from the dossier to describe mechanisms, observed phase transitions, and measurable circuit-level changes in transformer hidden states and attention patterns [5,9].

## How LLMs generate text (next-token prediction and pretraining)
Large language models are trained with self-supervised objectives that predict the next token given preceding context, allowing the models to learn statistical regularities of language from unlabelled text corpora [1]. Pretraining on massive datasets causes the models to develop representations in their embeddings and hidden layers that capture syntax, semantics, and common world patterns, which are then used during iterative inference to generate coherent text [1]. The next-token prediction paradigm can be extended to joint multi-token and latent-prediction variants in self-supervised frameworks, which appear in comparative diagrams of modeling choices for language pretraining. 
![The diagram illustrates the progression from next-token prediction using transformer architecture and word embeddings to multi-token and joint multi-token predictions, culminating in next-latent prediction with teacher-forced tokens, within a self-supervised pretraining framework for language models.](https://arxiv.org/html/2511.05963v4/images/model_comparison_2.png)
*This image shows model-comparison diagrams for next-token and multi-token prediction regimes and relates to the dossier's description of self-supervised pretraining objectives.*

## Transformer mechanisms enabling in-context learning
Transformer architectures enable in-context learning primarily through self-attention, which lets the model compute interactions among tokens and prioritize similar examples or relevant context within a prompt [5]. Embeddings provide token representations that the transformer layers manipulate via attention and feedforward blocks to form contextualized hidden states; these mechanisms together allow a pretrained transformer to implement algorithmic motifs that behave like few-shot learners when presented with examples in context [5]. The dossier reports that self-attention patterns and the distribution of training tasks influence ICL emergence, and that model scale explains most of the variance in few-shot in-context learning accuracy while attention patterns contribute less [5,9]. Visualizations of attention heatmaps in the dossier illustrate how attention focus changes with scale and during the phase transition associated with in-context learning.
![The image displays two pairs of original and overlayed heatmaps representing attention scores, with the heatmaps highlighting regions of focus in the context of model scale and phase transition in transformer in-context learning.](https://media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41598-025-24844-5/MediaObjects/41598_2025_24844_Fig9_HTML.png)
*This attention-heatmap image illustrates how attention focus patterns vary and supports the dossier's claims about attention motifs related to in-context learning behavior.*

## Model scale, training data and task diversity
Model scale and the diversity of pretraining tasks both materially influence an LLM's ability to generalize from few in-context examples; the dossier notes that few-shot in-context learning accuracy typically increases with larger transformer parameter counts, although exact per-decade gains are not specified [5]. Increasing pretraining task diversity drives a transition from solutions that are specialized to the pretraining distribution toward solutions that generalize out-of-distribution across broader task spaces [5,9]. Empirical statistics reported in the dossier indicate that increasing pretraining task diversity can boost transformer representation accuracy by about 2–3% and improve linear-probe accuracy by ~1.12%, with attention-head diversity increasing by ~4% as task diversity grows [9]. The dossier also includes plots showing how classification error varies with context length and task diversity parameters, illustrating the phase transition behavior across task settings.
![The figure displays two line plots comparing classification error against context length, illustrating how task diversity and phase transition in in-context learning transformers influence error rates across different values of α' and task settings.](https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-031-76770-8_4/MediaObjects/607129_1_En_4_Fig1_HTML.png)
*This plot of classification error versus context length illustrates how task diversity and phase transitions affect in-context performance, as discussed in the dossier.*

## Representational and circuit-level changes and how to measure them
As pretraining task diversity increases, transformers show measurable representational and circuit-level changes such as the formation of task-specific subspaces, increased linear decodability of task parameters, and the emergence of algorithmic attention motifs that implement in-context computations [9]. The dossier describes constructing phase diagrams to characterize how task diversity interacts with the number of pretraining tasks and reports similar transitions in both linear and nonlinear regression problems, indicating broad phenomena across problem types [9]. These changes are quantified using performance metrics (e.g., few-shot accuracy and linear-probe scores), attention-head diversity measures, and diagnostic analyses of hidden-state subspaces; the dossier reports concrete numbers such as a ~1.12% linear-probe accuracy gain and ~4% increase in attention-head diversity with more diverse pretraining [9]. The authors also show that the transition from specialized to generalized ICL can be causally manipulated by adjusting pretraining task diversity, suggesting experimental levers for shaping emergent capabilities [5,9].

## Conclusion
The dossier frames large language models as self-supervised, next-token-prediction systems implemented with transformer architectures that use embeddings and self-attention to form contextual representations and generate text [1]. In-context learning emerges from these architectures when pretraining includes sufficient task diversity and when models are scaled, with model scale explaining most variance in few-shot accuracy and task diversity driving phase transitions toward out-of-distribution generalization [5,9]. Representational and circuit-level analyses show measurable changes—task subspaces, linear decodability, and attention motifs—that accompany these transitions, with reported gains of ~2–3% in representation accuracy, ~1.12% in linear-probe accuracy, and ~4% in attention-head diversity as task diversity increases [9]. Together, these findings link architectural mechanisms, training data properties, and measurable internal changes to the observable capabilities of LLMs.

## Next Steps
Based on the dossier, further work should quantify how scaling laws interact with explicit measures of pretraining task diversity across more model sizes to pin down the relative contributions of scale and data distribution to few-shot accuracy [5,9]. Experimental manipulations that vary task diversity systematically while measuring linear-probe accuracy, attention-head diversity, and hidden-state subspace structure would clarify causal pathways for the phase transition described in the dossier [9]. Additional analyses of attention motifs and circuit motifs using causal intervention methods could test whether the observed algorithmic attention patterns are necessary for in-context learning behavior [5,9]. Finally, applying the same measurement and manipulation framework to nonlinear and more realistic language tasks will help determine the generality of the reported transitions across problem domains [9].

## References
https://uit.stanford.edu/service/techtraining/ai-demystified/llm

https://deepwiki.com/openai/gpt-3/1.1-model-architecture-and-training

https://discuss.huggingface.co/t/cross-architectural-runtime-probability-dynamics-in-transformer-llms-two-clusters-not-explained-by-parameter-count/176630

https://library.acadlore.com/IJKIS/2025/3/1/IJKIS_03.01_04.pdf

https://icml.cc/virtual/2025/poster/44914

https://openaccess.thecvf.com/content/CVPR2022/papers/Chen_The_Principle_of_Diversity_Training_Stronger_Vision_Transformers_Calls_for_CVPR_2022_paper.pdf

https://www.mdpi.com/2504-4990/6/4/126

https://www.paperdigest.org/2020/07/recent-papers-on-transformer

https://proceedings.mlr.press/v267/goddard25a.html

https://arxiv.org/html/2511.05963v4/images/model_comparison_2.png

https://media.springernature.com/lw685/springer-static/image/art%3A10.1038%2Fs41598-025-24844-5/MediaObjects/41598_2025_24844_Fig9_HTML.png

https://media.springernature.com/lw685/springer-static/image/chp%3A10.1007%2F978-3-031-76770-8_4/MediaObjects/607129_1_En_4_Fig1_HTML.png