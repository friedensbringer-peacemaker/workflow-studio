# Security

Do not publish credentials, private recordings or exploitable security details in an issue. For a problem specific to this fork, contact the repository owner through an established private channel. Rotate any exposed real credential at its provider; deleting a file alone does not revoke it.

For vulnerabilities confirmed in the original Microsoft Skill Recorder code, use [Microsoft security reporting guidance](https://aka.ms/SECURITY.md). This independent fork is not a Microsoft-supported product.

## Source hygiene

Profiles, recordings, transcripts, customer screenshots, local settings, private keys and build caches are excluded. New processes start empty. The source snapshot has its own Git history so that previous project-specific data is not carried into older commits.

The sensitive-data detection tests intentionally contain fake token-shaped strings, example passwords and reserved example domains. These are synthetic fixtures for exercising redaction and must never be used as credentials. The publication review distinguishes these fixtures from actual access values; it does not claim that automated scanning can prove the absence of every possible secret.

## Validation scope

Source tests and an isolated startup check are not a production security audit. Real provider connections, capture permissions and packaged releases require separate acceptance. Dependency and license reviews must be repeated before a broad binary release. See [validation notes](docs/fork/VALIDATION.md).
