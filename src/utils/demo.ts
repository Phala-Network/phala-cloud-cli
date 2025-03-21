const jupyterCompose = `version: '3'
services:
  jupyter:
    image: quay.io/jupyter/base-notebook
    ports:
      - 8080:8888
    volumes:
      - /var/run/tappd.sock:/var/run/tappd.sock
    environment:
      - GRANT_SUDO=yes
    user: root
    command: "start-notebook.sh --NotebookApp.token=\${TOKEN}"
`;

export const httpbinCompose = `version: '3'
services:
  httpbin:
    image: kennethreitz/httpbin:latest
    ports:
      - "80:80"
`;


export const demoTemplates = {
  jupyter: {
    compose: jupyterCompose,
    name: "Jupyter Notebook",
  },
  httpbin: {
    compose: httpbinCompose,
    name: "HTTPBin",
  },
};
