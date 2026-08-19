# Scientific and Product Limitations

1. **Changed target.** EEL and the legacy target define different prediction tasks and class balances. Their scores may be shown descriptively but not as a controlled same-task model improvement.
2. **Test reuse.** The fixed 13,263-row Test set was inspected in earlier research. The final run does not tune on it, but it is not a pristine future holdout.
3. **Six accounts.** Technical inference excludes username and history, yet leave-one-account-out results were substantially weaker. Equal accuracy for unseen accounts is not proven.
4. **Expectation-model convergence.** The selected A0 expectation family recorded 9/18 converged required fits. Alternative fully converged families were tested and performed worse on Validation. This remains a construct-validity risk.
5. **False positives.** Recall is intentionally high (0.8889), while specificity is 0.4570. Many Low posts are classified High; probabilities and thresholds must be shown honestly.
6. **Observational data.** Recommendations are model-guided counterfactual directions, not causal guarantees. A higher re-score is not evidence that publication will cause more engagement.
7. **Platform drift.** Instagram behavior, content and ranking policies change. Monitoring and chronological future validation are required.
8. **Optional AI revisions.** OpenAI output can be unsuitable or fail. The user must review all edits. The frozen EngageVision model, not OpenAI, supplies the comparative score.
9. **Language coverage.** The UI supports English, Hebrew and Arabic. Data and embeddings may not represent all dialects or cultural contexts equally.
10. **Privacy.** Uploaded images and captions may contain personal data. Production deployment requires a clear retention policy, consent, transport security and least-privilege access.

The application must always state that predictions are probabilistic and do not guarantee success.

