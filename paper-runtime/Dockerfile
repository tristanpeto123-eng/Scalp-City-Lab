FROM node:22-alpine
WORKDIR /opt/scalp-city
COPY --chown=node:node paper-runtime/ ./
USER node
ENV SCALP_JOURNAL_DIR=/data SCALP_BIND=0.0.0.0 PORT=8787 SCALP_PAPER_ENABLED=false
EXPOSE 8787
CMD ["node","service.mjs"]
