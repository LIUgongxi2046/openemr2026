FROM node:24.13.0-bookworm-slim
RUN groupadd --system --gid 10001 openemr2026 \
    && useradd --system --uid 10001 --gid openemr2026 --home-dir /opt/openemr2026 openemr2026
WORKDIR /opt/openemr2026/web
COPY --chown=openemr2026:openemr2026 web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts && npm cache clean --force
COPY --chown=openemr2026:openemr2026 web/ ./
USER 10001:10001
EXPOSE 4177
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
