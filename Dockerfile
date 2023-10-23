FROM python:3.11-slim-bookworm

RUN apt update && apt install -y --no-install-recommends python3-dev gcc libc-dev nodejs npm && rm -rf /var/cache/apt/archives/*

RUN pip3 install --upgrade pip && \
    pip3 install "Cython<3.0" "pyyaml<6" --no-build-isolation && \
    pip3 install taskcat==0.9.40 --upgrade

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY dist/index.js /dist/index.js

ENTRYPOINT ["/entrypoint.sh"]
