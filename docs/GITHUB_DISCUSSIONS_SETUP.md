# GitHub Discussions Setup <img src="../logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

GitHub Discussions must be enabled by a repository owner or collaborator with write access. Adding repository files cannot enable it.

## Enable Discussions

1. Open the [Manuscript Compiler repository](https://github.com/anthonyfitzpatrick/manuscript-compiler).
2. Select **Settings** beneath the repository name. If **Settings** is not visible, the signed-in account does not have the required repository permission.
3. On the **General** settings page, scroll to **Features**.
4. Beside **Discussions**, select **Set up discussions**.
5. Review and edit GitHub's proposed welcome post so it links to [SUPPORT.md](../SUPPORT.md), [USER_GUIDE.md](../USER_GUIDE.md), and the [Code of Conduct](../CODE_OF_CONDUCT.md).
6. Select **Start discussion**. This publishes the welcome post and enables the repository's **Discussions** tab.

Pin the welcome post after publication so contributors see the repository's support boundaries before starting a conversation.

## Configure categories

Open the repository's **Discussions** tab, select the category-management control beside **Categories**, and create or update these categories:

| Category | Recommended format | Recommended description |
| --- | --- | --- |
| **General** | Open-ended discussion | Discuss Manuscript Compiler, author workflows, publishing practices, and community topics that do not fit another category. |
| **Show and Tell** | Open-ended discussion | Share manuscript structures, publishing workflows, export results, integrations, and lessons that may help other authors. Never post private manuscript material without permission. |
| **Questions** | Question and answer | Ask for help using Manuscript Compiler after checking the User Guide. Include relevant versions and synthetic examples, and mark the response that resolves the question. |
| **Ideas** | Open-ended discussion | Explore possible improvements before opening a focused feature request. Start with the author problem, constraints, and alternatives. |
| **Announcements** | Announcement | Maintainer-authored release announcements, compatibility notices, security guidance, and important project updates. |

Restrict creation in **Announcements** to maintainers. Allow community replies when feedback is useful, and lock completed announcements when continued replies would create support noise.

## Recommended welcome post

The first post should briefly explain:

- Discussions are for questions, ideas, workflows, and community conversation.
- Reproducible defects belong in the [bug report form](https://github.com/anthonyfitzpatrick/manuscript-compiler/issues/new?template=bug_report.yml).
- Focused improvements belong in the [feature request form](https://github.com/anthonyfitzpatrick/manuscript-compiler/issues/new?template=feature_request.yml).
- Vulnerabilities must be reported privately according to [SECURITY.md](../SECURITY.md).
- All participation is governed by the [Code of Conduct](../CODE_OF_CONDUCT.md).
- Contributors must not post private manuscript text, vault paths, credentials, or unredacted diagnostics.

## Final checks

After setup:

1. Confirm the **Discussions** tab is visible while signed out.
2. Confirm all five categories are available and use the intended format.
3. Confirm only maintainers can create **Announcements**.
4. Open each link in the welcome post.
5. Confirm the question and feature-request contact links in `.github/ISSUE_TEMPLATE/config.yml` reach Discussions.
