# HomeForSale — Property Gallery

## Publish on GitHub Pages

This project is a static site and can be published on GitHub Pages. The repository includes a workflow to deploy the site automatically on push to the `main` branch.

Quick steps:

1. Push this repository to GitHub (create a repo under your account)
2. Ensure your default branch is named `main` (or update `.github/workflows/pages.yml` to the branch you use).
3. In your repository settings -> Pages, you can verify the site; the Action `Deploy GitHub Pages` will publish the site automatically.
4. The repository URL is https://github.com/tvv1001/homes-for-sale — `robots.txt` and `sitemap.xml` have been updated to point to the Pages site at https://tvv1001.github.io/homes-for-sale/

Notes:

- A `.nojekyll` file is included so GitHub Pages will not process the site with Jekyll.
- The site includes basic SEO meta tags (description + robots) in the main pages.
