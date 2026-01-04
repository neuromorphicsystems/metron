import { mount } from "svelte";
import App from "./app.svelte";
import "./styles.css";

export default mount(App, { target: document.body });
